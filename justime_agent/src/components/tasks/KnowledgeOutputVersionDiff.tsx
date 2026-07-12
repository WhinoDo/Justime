'use client'

import { useEffect, useMemo, useState } from 'react'
import type { KnowledgeOutput } from '@/types/taskProcess'

type DiffKind = 'addition' | 'deletion' | 'unchanged'

interface DiffLine {
  kind: DiffKind
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

interface VersionSnapshot {
  version: number
  title: string
  markdown: string
  isCurrent: boolean
}

interface KnowledgeOutputVersionDiffProps {
  output: KnowledgeOutput
}

function splitLines(content: string) {
  return content.replace(/\r\n?/g, '\n').split('\n')
}

function getDiagonalPosition(positions: Map<number, number>, diagonal: number) {
  return positions.get(diagonal) ?? 0
}

export function buildKnowledgeOutputLineDiff(previous: string, next: string): DiffLine[] {
  const previousLines = splitLines(previous)
  const nextLines = splitLines(next)
  const maxDistance = previousLines.length + nextLines.length
  const trace: Map<number, number>[] = []
  const positions = new Map<number, number>([[1, 0]])

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    trace.push(new Map(positions))

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const moveDown = diagonal === -distance
        || (diagonal !== distance
          && getDiagonalPosition(positions, diagonal - 1) < getDiagonalPosition(positions, diagonal + 1))
      let oldIndex = moveDown
        ? getDiagonalPosition(positions, diagonal + 1)
        : getDiagonalPosition(positions, diagonal - 1) + 1
      let newIndex = oldIndex - diagonal

      while (
        oldIndex < previousLines.length
        && newIndex < nextLines.length
        && previousLines[oldIndex] === nextLines[newIndex]
      ) {
        oldIndex += 1
        newIndex += 1
      }

      positions.set(diagonal, oldIndex)

      if (oldIndex >= previousLines.length && newIndex >= nextLines.length) {
        const reversed: Omit<DiffLine, 'oldLineNumber' | 'newLineNumber'>[] = []
        let traceOldIndex = previousLines.length
        let traceNewIndex = nextLines.length

        for (let traceDistance = trace.length - 1; traceDistance >= 0; traceDistance -= 1) {
          const tracePositions = trace[traceDistance]
          const traceDiagonal = traceOldIndex - traceNewIndex
          const moveFromTop = traceDiagonal === -traceDistance
            || (traceDiagonal !== traceDistance
              && getDiagonalPosition(tracePositions, traceDiagonal - 1) < getDiagonalPosition(tracePositions, traceDiagonal + 1))
          const previousDiagonal = moveFromTop ? traceDiagonal + 1 : traceDiagonal - 1
          const previousOldIndex = getDiagonalPosition(tracePositions, previousDiagonal)
          const previousNewIndex = previousOldIndex - previousDiagonal

          while (traceOldIndex > previousOldIndex && traceNewIndex > previousNewIndex) {
            reversed.push({ kind: 'unchanged', content: previousLines[traceOldIndex - 1] })
            traceOldIndex -= 1
            traceNewIndex -= 1
          }

          if (traceDistance === 0) break

          if (traceOldIndex === previousOldIndex) {
            reversed.push({ kind: 'addition', content: nextLines[traceNewIndex - 1] })
            traceNewIndex -= 1
          } else {
            reversed.push({ kind: 'deletion', content: previousLines[traceOldIndex - 1] })
            traceOldIndex -= 1
          }
        }

        let oldLineNumber = 0
        let newLineNumber = 0

        return reversed.reverse().map((line) => {
          if (line.kind !== 'addition') oldLineNumber += 1
          if (line.kind !== 'deletion') newLineNumber += 1

          return {
            ...line,
            oldLineNumber: line.kind === 'addition' ? undefined : oldLineNumber,
            newLineNumber: line.kind === 'deletion' ? undefined : newLineNumber,
          }
        })
      }
    }
  }

  return []
}

function getVersionSnapshots(output: KnowledgeOutput): VersionSnapshot[] {
  const snapshots = new Map<number, VersionSnapshot>()

  output.version_history?.forEach((version) => {
    snapshots.set(version.version, {
      version: version.version,
      title: version.title,
      markdown: version.markdown,
      isCurrent: false,
    })
  })

  snapshots.set(output.version, {
    version: output.version,
    title: output.title,
    markdown: output.markdown,
    isCurrent: true,
  })

  return Array.from(snapshots.values()).sort((left, right) => left.version - right.version)
}

const diffStyles: Record<DiffKind, { row: string; badge: string; label: string; marker: string }> = {
  addition: {
    row: 'bg-emerald-300/10 text-emerald-50',
    badge: 'text-emerald-200',
    label: '新增',
    marker: '+',
  },
  deletion: {
    row: 'bg-rose-300/10 text-rose-50',
    badge: 'text-rose-200',
    label: '删除',
    marker: '-',
  },
  unchanged: {
    row: 'text-white/60',
    badge: 'text-white/35',
    label: '未变',
    marker: ' ',
  },
}

export function KnowledgeOutputVersionDiff({ output }: KnowledgeOutputVersionDiffProps) {
  const snapshots = useMemo(() => getVersionSnapshots(output), [output])
  const currentVersion = String(output.version)
  const latestHistoricalVersion = snapshots.filter((snapshot) => !snapshot.isCurrent).at(-1)
  const [baseVersion, setBaseVersion] = useState(latestHistoricalVersion ? String(latestHistoricalVersion.version) : currentVersion)
  const [comparisonVersion, setComparisonVersion] = useState(currentVersion)

  useEffect(() => {
    const historicalVersion = snapshots.filter((snapshot) => !snapshot.isCurrent).at(-1)
    setBaseVersion(historicalVersion ? String(historicalVersion.version) : currentVersion)
    setComparisonVersion(currentVersion)
  }, [currentVersion, snapshots])

  const baseSnapshot = snapshots.find((snapshot) => String(snapshot.version) === baseVersion)
  const comparisonSnapshot = snapshots.find((snapshot) => String(snapshot.version) === comparisonVersion)
  const diff = useMemo(
    () => baseSnapshot && comparisonSnapshot
      ? buildKnowledgeOutputLineDiff(baseSnapshot.markdown, comparisonSnapshot.markdown)
      : [],
    [baseSnapshot, comparisonSnapshot],
  )
  const hasChanges = diff.some((line) => line.kind !== 'unchanged')

  if (!latestHistoricalVersion) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/10 p-6 text-center text-sm text-white/55" role="status">
        当前还没有可用于比较的历史版本。
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm text-white/70">
          <span>基准版本</span>
          <select
            aria-label="基准版本"
            value={baseVersion}
            onChange={(event) => setBaseVersion(event.target.value)}
            className="h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
          >
            {snapshots.map((snapshot) => (
              <option key={`base-${snapshot.version}`} value={snapshot.version}>
                v{snapshot.version}{snapshot.isCurrent ? '（当前）' : ''} · {snapshot.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm text-white/70">
          <span>比较版本</span>
          <select
            aria-label="比较版本"
            value={comparisonVersion}
            onChange={(event) => setComparisonVersion(event.target.value)}
            className="h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
          >
            {snapshots.map((snapshot) => (
              <option key={`comparison-${snapshot.version}`} value={snapshot.version}>
                v{snapshot.version}{snapshot.isCurrent ? '（当前）' : ''} · {snapshot.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!baseSnapshot || !comparisonSnapshot ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/10 p-6 text-sm text-white/55" role="status">
          所选版本不可用，请重新选择。
        </div>
      ) : !hasChanges ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-emerald-200/20 bg-emerald-300/10 p-6 text-sm text-emerald-100" role="status">
          两个版本的 Markdown 内容一致，没有变化。
        </div>
      ) : (
        <ol className="min-h-0 flex-1 overflow-auto rounded-lg border border-white/10 bg-black/15 py-2 font-mono text-xs" aria-label="版本差异">
          {diff.map((line, index) => {
            const style = diffStyles[line.kind]
            const readableContent = line.content || '空行'

            return (
              <li
                key={`${line.kind}-${line.oldLineNumber ?? 'new'}-${line.newLineNumber ?? 'old'}-${index}`}
                className={`grid min-h-7 grid-cols-[2.25rem_2.25rem_3rem_minmax(0,1fr)] items-start gap-1 px-2 py-1 ${style.row}`}
                aria-label={`${style.label}：${readableContent}`}
              >
                <span className="text-right tabular-nums text-white/30" aria-hidden="true">{line.oldLineNumber ?? ''}</span>
                <span className="text-right tabular-nums text-white/30" aria-hidden="true">{line.newLineNumber ?? ''}</span>
                <span className={`font-sans ${style.badge}`} aria-hidden="true">{style.label}</span>
                <span className="whitespace-pre-wrap break-words"><span aria-hidden="true">{style.marker} </span>{line.content || ' '}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
