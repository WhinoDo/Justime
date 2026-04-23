#!/usr/bin/env python3
"""
Download a YouTube video, extract audio, transcribe it, and generate a summary.

Requirements:
  - Python package: openai
  - Python package (open-source transcription): faster-whisper
  - CLI tools: yt-dlp, ffmpeg
  - Optional key only if using OpenAI summary: OPENAI_API_KEY (or pass --api-key)
  - Summary key (default DeepSeek): DEEPSEEK_API_KEY (or pass --deepseek-api-key)
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import textwrap
import warnings
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from time import monotonic
from typing import List

try:
    from openai import OpenAI  # type: ignore
except ImportError:
    OpenAI = None  # type: ignore[assignment]


@dataclass
class RunPaths:
    run_dir: Path
    video_path: Path
    audio_path: Path
    transcript_path: Path
    summary_path: Path


LOCAL_WHISPER_MODEL = "large-v3"
LOCAL_WHISPER_DEVICE = "auto"
LOCAL_WHISPER_COMPUTE_TYPE = "float32"


def require_command(cmd: str) -> None:
    if shutil.which(cmd):
        return
    raise RuntimeError(
        f"Missing required command: {cmd}. Please install it and retry."
    )


def run_command(args: List[str]) -> str:
    result = subprocess.run(args, check=True, text=True, capture_output=True)
    return result.stdout.strip()


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._-")
    return cleaned or "youtube_job"


def split_text(text: str, max_chars: int = 12000) -> List[str]:
    parts: List[str] = []
    current: List[str] = []
    current_len = 0

    for paragraph in text.splitlines():
        p = paragraph.strip()
        if not p:
            continue
        if current_len + len(p) + 1 <= max_chars:
            current.append(p)
            current_len += len(p) + 1
            continue
        if current:
            parts.append("\n".join(current))
        current = [p]
        current_len = len(p)

    if current:
        parts.append("\n".join(current))
    return parts or [text]


def download_video(url: str, run_dir: Path) -> Path:
    output_template = str(run_dir / "video.%(ext)s")
    print("1/5 Downloading video...")
    out = run_command(
        [
            "yt-dlp",
            "--no-playlist",
            "--merge-output-format",
            "mp4",
            "-f",
            "bestvideo*+bestaudio/best",
            "-o",
            output_template,
            "--print",
            "after_move:filepath",
            url,
        ]
    )
    video_path = Path(out.splitlines()[-1]).expanduser().resolve()
    if not video_path.exists():
        raise RuntimeError(f"Video file not found after download: {video_path}")
    return video_path


def extract_audio(video_path: Path, audio_path: Path) -> None:
    print("2/5 Extracting audio...")
    run_command(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            str(audio_path),
        ]
    )
    if not audio_path.exists():
        raise RuntimeError(f"Audio file not generated: {audio_path}")


def transcribe_audio_faster_whisper(
    audio_path: Path,
    language: str | None,
) -> str:
    print("3/5 Transcribing audio with open-source faster-whisper...")
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Missing package 'faster-whisper'. Install it with: pip install faster-whisper"
        ) from exc

    model = WhisperModel(
        LOCAL_WHISPER_MODEL,
        device=LOCAL_WHISPER_DEVICE,
        compute_type=LOCAL_WHISPER_COMPUTE_TYPE,
    )
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=RuntimeWarning)
        segments, _ = model.transcribe(
            str(audio_path),
            language=language,
            vad_filter=True,
            beam_size=5,
        )
    texts: List[str] = []
    start_ts = monotonic()
    for idx, segment in enumerate(segments, start=1):
        segment_text = segment.text.strip()
        if segment_text:
            texts.append(segment_text)
        if idx % 30 == 0:
            elapsed = int(monotonic() - start_ts)
            print(
                f"  - Transcribed segments: {idx}, elapsed: {elapsed}s",
                flush=True,
            )

    text = "\n".join(texts).strip()
    if not text:
        raise RuntimeError("Open-source transcription returned empty text.")
    return text


def summarize_text(
    client: OpenAI, transcript_text: str, model: str, output_language: str
) -> str:
    print("4/5 Summarizing content...")
    chunks = split_text(transcript_text)
    chunk_summaries: List[str] = []

    for idx, chunk in enumerate(chunks, start=1):
        print(f"  - Summarizing chunk {idx}/{len(chunks)}")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You summarize transcript chunks clearly and factually. "
                        f"Write in {output_language}."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Summarize this transcript chunk in 6-10 bullet points, "
                        "capturing claims, evidence, and practical takeaways.\n\n"
                        f"{chunk}"
                    ),
                },
            ],
            temperature=0.2,
        )
        message = (response.choices[0].message.content if response.choices else "") or ""
        chunk_text = str(message).strip()
        if not chunk_text:
            raise RuntimeError("Chunk summary returned empty content.")
        chunk_summaries.append(chunk_text)

    merged = "\n\n".join(
        f"Chunk {i + 1} summary:\n{value}" for i, value in enumerate(chunk_summaries)
    )

    final_response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You create structured summaries from transcript notes. "
                    f"Write in {output_language}."
                ),
            },
            {
                "role": "user",
                "content": textwrap.dedent(
                    f"""
                    Build a final summary document from the chunk summaries below.
                    Output in markdown with these sections:
                    1) Title
                    2) Executive Summary
                    3) Key Insights (bullet points)
                    4) Actionable Items
                    5) Notable Quotes or Data Points
                    6) Open Questions

                    Chunk summaries:
                    {merged}
                    """
                ).strip(),
            },
        ],
        temperature=0.2,
    )

    final_message = (
        final_response.choices[0].message.content if final_response.choices else ""
    ) or ""
    final_text = str(final_message).strip()
    if not final_text:
        raise RuntimeError("Final summary returned empty content.")
    return final_text


def write_outputs(paths: RunPaths, summary_md: str, transcript_text: str, url: str) -> None:
    print("5/5 Writing output files...")
    timestamp = datetime.now().isoformat(timespec="seconds")

    transcript_payload = textwrap.dedent(
        f"""
        Source URL: {url}
        Generated at: {timestamp}

        {transcript_text}
        """
    ).strip()
    paths.transcript_path.write_text(transcript_payload, encoding="utf-8")

    summary_payload = textwrap.dedent(
        f"""
        Source URL: {url}
        Generated at: {timestamp}

        {summary_md}
        """
    ).strip()
    paths.summary_path.write_text(summary_payload, encoding="utf-8")


def make_paths(output_dir: Path, url: str) -> RunPaths:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    job_name = safe_name(url)
    run_dir = output_dir / f"{stamp}_{job_name[:40]}"
    run_dir.mkdir(parents=True, exist_ok=True)

    return RunPaths(
        run_dir=run_dir,
        video_path=run_dir / "video.mp4",
        audio_path=run_dir / "audio.wav",
        transcript_path=run_dir / "transcript.txt",
        summary_path=run_dir / "summary.md",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download YouTube video, transcribe audio, and summarize content."
    )
    parser.add_argument("url", nargs="?", help="YouTube URL")
    parser.add_argument(
        "--output-dir",
        default="output/youtube_summaries",
        help="Directory to store generated files.",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help=(
            "OpenAI API key for OpenAI summary provider. "
            "If omitted, OPENAI_API_KEY is used."
        ),
    )
    parser.add_argument(
        "--summary-provider",
        choices=["deepseek", "openai"],
        default="deepseek",
        help="Model provider for summary stage (default: deepseek).",
    )
    parser.add_argument(
        "--deepseek-api-key",
        default=None,
        help="DeepSeek API key. If omitted, DEEPSEEK_API_KEY is used.",
    )
    parser.add_argument(
        "--summary-model",
        default=None,
        help="Model used for summarization.",
    )
    parser.add_argument(
        "--transcript-language",
        default=None,
        help="Optional ISO-639-1 language hint for transcription (e.g. en, zh).",
    )
    parser.add_argument(
        "--output-language",
        default="Chinese",
        help="Language for the final summary document.",
    )
    parser.add_argument(
        "--keep-video",
        action="store_true",
        help="Keep downloaded video file (default removes it after audio extraction).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    url = (args.url or input("Enter YouTube URL: ").strip()).strip()
    if not url:
        print("Error: URL is required.", file=sys.stderr)
        return 1

    try:
        require_command("yt-dlp")
        require_command("ffmpeg")
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    openai_api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if OpenAI is None:
        print(
            "Error: Python package 'openai' is not installed. Run: pip install openai",
            file=sys.stderr,
        )
        return 1

    output_dir = Path(args.output_dir).expanduser().resolve()
    paths = make_paths(output_dir, url)
    summary_model = args.summary_model
    if args.summary_provider == "deepseek":
        deepseek_api_key = args.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")
        if not deepseek_api_key:
            print(
                "Error: DEEPSEEK_API_KEY is missing. Use --deepseek-api-key or set env var.",
                file=sys.stderr,
            )
            return 1
        summary_client = OpenAI(
            api_key=deepseek_api_key,
            base_url="https://api.deepseek.com",
        )
        if not summary_model:
            summary_model = "deepseek-reasoner"
    else:
        if not openai_api_key:
            print(
                "Error: OPENAI_API_KEY is missing for OpenAI summary provider.",
                file=sys.stderr,
            )
            return 1
        summary_client = OpenAI(api_key=openai_api_key)
        if not summary_model:
            summary_model = "gpt-4.1-mini"

    try:
        downloaded_video = download_video(url, paths.run_dir)
        extract_audio(downloaded_video, paths.audio_path)
        if not args.keep_video and downloaded_video.exists():
            downloaded_video.unlink()

        print(
            "Using local transcription: "
            f"provider=faster-whisper, model={LOCAL_WHISPER_MODEL}, "
            f"device={LOCAL_WHISPER_DEVICE}, compute_type={LOCAL_WHISPER_COMPUTE_TYPE}"
        )
        transcript_text = transcribe_audio_faster_whisper(
            audio_path=paths.audio_path,
            language=args.transcript_language,
        )
        print(f"Using {args.summary_provider} model: {summary_model}")
        summary_md = summarize_text(
            client=summary_client,
            transcript_text=transcript_text,
            model=summary_model,
            output_language=args.output_language,
        )
        write_outputs(
            paths=paths,
            summary_md=summary_md,
            transcript_text=transcript_text,
            url=url,
        )
    except subprocess.CalledProcessError as exc:
        print("Command failed:", " ".join(exc.cmd), file=sys.stderr)
        print(exc.stderr or exc.stdout, file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("\nDone.")
    print(f"Summary:    {paths.summary_path}")
    print(f"Transcript: {paths.transcript_path}")
    print(f"Audio:      {paths.audio_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
