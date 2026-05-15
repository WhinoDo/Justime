import { Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { AdminModel } from './useModels'

interface ModelTableProps {
    models: AdminModel[]
    onEdit: (model: AdminModel) => void
    onDelete: (model: AdminModel) => void
    onToggleEnabled: (model: AdminModel, enabled: boolean) => void
}

export function ModelTable({ models, onEdit, onDelete, onToggleEnabled }: ModelTableProps) {
    return (
        <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden text-white w-full">
            <Table className="text-white">
                <TableHeader className="[&_tr]:border-white/10 bg-white/5">
                    <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/80">名称</TableHead>
                        <TableHead className="text-white/80">模型ID</TableHead>
                        <TableHead className="text-white/80">优先级</TableHead>
                        <TableHead className="text-white/80">能力标签</TableHead>
                        <TableHead className="text-white/80">启用</TableHead>
                        <TableHead className="text-white/80">API Key</TableHead>
                        <TableHead className="text-right text-white/80">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {models.map((model) => (
                        <TableRow key={model.id} className="border-white/10 hover:bg-white/5">
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium text-white">{model.name}</span>
                                    <span className="text-xs text-white/60">{model.base_url}</span>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-white/80">{model.model_id}</TableCell>
                            <TableCell className="text-white/80">{model.priority}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {model.capabilities.length === 0 ? (
                                        <span className="text-white/50 text-xs">-</span>
                                    ) : (
                                        model.capabilities.map((cap) => (
                                            <Badge key={`${model.id}-${cap}`} variant="secondary" className="text-xs bg-blue-500/20 text-blue-200 hover:bg-blue-500/20">
                                                {cap}
                                            </Badge>
                                        ))
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Switch
                                    checked={model.enabled}
                                    onCheckedChange={(checked) => onToggleEnabled(model, checked)}
                                />
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <Badge variant={model.has_api_key ? 'default' : 'secondary'} className={model.has_api_key ? 'bg-green-500/20 text-green-200 hover:bg-green-500/20' : 'bg-gray-500/20 text-gray-200 hover:bg-gray-500/20'}>
                                        {model.has_api_key ? '已配置' : '未配置'}
                                    </Badge>
                                    {model.api_key_id ? (
                                        <span className="text-xs text-white/60">
                                            引用: {model.api_key_name || model.api_key_id}
                                        </span>
                                    ) : null}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button variant="outline" size="sm" className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white" onClick={() => onEdit(model)}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="border-red-300/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100" onClick={() => onDelete(model)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
