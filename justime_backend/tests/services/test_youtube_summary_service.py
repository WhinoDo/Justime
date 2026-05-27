import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services.youtube_summary_service import YouTubeSummaryService


class YouTubeSummaryServiceTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.service = YouTubeSummaryService()
        self.asr_config = {
            "api_key": "dashscope-key",
            "base_url": "https://dashscope.aliyuncs.com/api/v1",
            "model_id": "paraformer-v2",
            "timeout_seconds": 120,
        }
        self.oss_config = {
            "endpoint": "https://oss-cn-beijing.aliyuncs.com",
            "bucket": "private-bucket",
            "access_key_id": "ak",
            "access_key_secret": "sk",
            "prefix": "youtube-summary-temp",
            "signed_url_expires_seconds": 3600,
        }

    async def test_submit_paraformer_task_success(self) -> None:
        self.service._http_post_json = AsyncMock(return_value={"output": {"task_id": "task-123"}})  # type: ignore[attr-defined]

        task_id = await self.service._submit_paraformer_task(
            file_urls=["https://signed.example/audio.wav"],
            asr_config=self.asr_config,
        )

        self.assertEqual(task_id, "task-123")
        self.service._http_post_json.assert_awaited_once()  # type: ignore[attr-defined]

    async def test_poll_paraformer_task_success(self) -> None:
        self.service._http_get_json = AsyncMock(  # type: ignore[attr-defined]
            side_effect=[
                {"output": {"task_status": "RUNNING"}},
                {
                    "output": {
                        "task_status": "SUCCEEDED",
                        "results": [{"text": "第一句"}, {"text": "第二句"}],
                    }
                },
            ]
        )

        with patch("app.services.youtube_summary_service.asyncio.sleep", new=AsyncMock()):
            transcript = await self.service._poll_paraformer_result(
                task_id="task-123",
                asr_config=self.asr_config,
            )

        self.assertEqual(transcript, "第一句\n第二句")

    async def test_poll_paraformer_task_failed_raises(self) -> None:
        self.service._http_get_json = AsyncMock(  # type: ignore[attr-defined]
            return_value={"output": {"task_status": "FAILED", "message": "invalid api key"}}
        )

        with self.assertRaisesRegex(RuntimeError, "paraformer 任务失败"):
            await self.service._poll_paraformer_result(task_id="task-123", asr_config=self.asr_config)

    async def test_poll_paraformer_task_timeout_raises(self) -> None:
        asr_config = dict(self.asr_config)
        asr_config["timeout_seconds"] = 1
        self.service._http_get_json = AsyncMock(  # type: ignore[attr-defined]
            return_value={"output": {"task_status": "RUNNING"}}
        )

        with patch("app.services.youtube_summary_service.asyncio.sleep", new=AsyncMock()), patch(
            "app.services.youtube_summary_service.time.monotonic",
            side_effect=[0.0, 0.1, 1.2],
        ):
            with self.assertRaisesRegex(RuntimeError, "paraformer 任务超时"):
                await self.service._poll_paraformer_result(task_id="task-123", asr_config=asr_config)

    async def test_poll_paraformer_task_empty_result_raises(self) -> None:
        self.service._http_get_json = AsyncMock(  # type: ignore[attr-defined]
            return_value={"output": {"task_status": "SUCCEEDED", "results": [{}]}}
        )

        with self.assertRaisesRegex(RuntimeError, "内容为空"):
            await self.service._poll_paraformer_result(task_id="task-123", asr_config=self.asr_config)

    async def test_transcribe_audio_always_cleans_oss_object(self) -> None:
        self.service._upload_audio_and_get_signed_url = AsyncMock(  # type: ignore[attr-defined]
            return_value="https://signed.example/audio.wav"
        )
        self.service._submit_paraformer_task = AsyncMock(  # type: ignore[attr-defined]
            side_effect=RuntimeError("submit failed")
        )
        self.service._delete_oss_object = AsyncMock()  # type: ignore[attr-defined]
        self.service._update_job = AsyncMock()  # type: ignore[attr-defined]

        with self.assertRaisesRegex(RuntimeError, "submit failed"):
            await self.service._transcribe_audio(
                audio_path=Path("/tmp/audio.wav"),
                job_id="job-1",
                item_index=0,
                asr_config=self.asr_config,
                oss_config=self.oss_config,
            )

        self.service._delete_oss_object.assert_awaited_once()  # type: ignore[attr-defined]


if __name__ == "__main__":
    unittest.main()
