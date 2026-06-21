'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Edit2, Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

interface AdminApiKey {
    id: string
    name: string
    has_api_key: boolean
    updated_at?: string
}

interface ApiKeyFormState {
    id: string
    name: string
    api_key: string
}

const emptyForm: ApiKeyFormState = {
    id: '',
    name: '',
    api_key: '',
}

export default function AdminApiKeysPage() {
    const [keys, setKeys] = useState<AdminApiKey[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingKey, setEditingKey] = useState<AdminApiKey | null>(null)
    const [form, setForm] = useState<ApiKeyFormState>(emptyForm)
    const { toast } = useToast()

    const sortedKeys = useMemo(
        () => [...keys].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
        [keys]
    )

    const fetchApiKeys = async () => {
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.API_KEYS)
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '获取 API Key 列表失败')
            setKeys(Array.isArray(result?.data) ? result.data : [])
        } catch (error) {
            toast({
                title: '获取 API Key 失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchApiKeys()
    }, [])

    const openCreateDialog = () => {
        setEditingKey(null)
        setForm(emptyForm)
        setDialogOpen(true)
    }

    const openEditDialog = (key: AdminApiKey) => {
        setEditingKey(key)
        setForm({
            id: key.id,
            name: key.name,
            api_key: ''
        })
        setDialogOpen(true)
    }

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            toast({
                title: '表单不完整',
                description: '请填写 API Key 名称',
                variant: 'destructive'
            })
            return
        }

        if (!editingKey && !form.api_key.trim()) {
            toast({
                title: '表单不完整',
                description: '新增 API Key 时必须输入密钥',
                variant: 'destructive'
            })
            return
        }

        setSaving(true)
        try {
            const isEdit = !!editingKey
            const endpoint = isEdit ? API_ENDPOINTS.ADMIN.API_KEY(editingKey.id) : API_ENDPOINTS.ADMIN.API_KEYS
            const method = isEdit ? 'PUT' : 'POST'
            const payload: Record<string, unknown> = {
                id: form.id.trim() || undefined,
                name: form.name.trim(),
            }
            if (!isEdit || form.api_key.trim()) {
                payload.api_key = form.api_key.trim()
            }

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '保存 API Key 失败')

            toast({
                title: isEdit ? 'API Key 更新成功' : 'API Key 创建成功',
                className: 'bg-green-50 border-green-200 text-green-800'
            })
            setDialogOpen(false)
            fetchApiKeys()
        } catch (error) {
            toast({
                title: '保存失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (key: AdminApiKey) => {
        if (!confirm(`确定要删除 API Key "${key.name}" 吗？`)) return
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.API_KEY(key.id), { method: 'DELETE' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '删除 API Key 失败')
            toast({
                title: 'API Key 删除成功',
                className: 'bg-green-50 border-green-200 text-green-800'
            })
            fetchApiKeys()
        } catch (error) {
            toast({
                title: '删除失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-foreground/80" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">API Key 管理</h2>
                    <p className="text-muted-foreground">管理可复用的系统 API Key，供模型配置统一引用。</p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2 bg-accent/50 border border-border text-foreground hover:bg-accent">
                    <Plus className="w-4 h-4" />
                    新增 API Key
                </Button>
            </div>

            {sortedKeys.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/50 backdrop-blur-xl p-10 text-center">
                    <p className="text-foreground/80 text-sm">当前还没有通用 API Key</p>
                    <p className="text-muted-foreground text-xs mt-2">添加后可在模型管理中直接引用，避免重复填写。</p>
                    <Button onClick={openCreateDialog} className="gap-2 mt-5 bg-accent/50 border border-border text-foreground hover:bg-accent">
                        <Plus className="w-4 h-4" />
                        添加首个 API Key
                    </Button>
                </div>
            ) : (
                <div className="rounded-2xl border border-border bg-muted/30 backdrop-blur-xl shadow-2xl overflow-hidden text-foreground w-full">
                    <Table className="text-foreground">
                        <TableHeader className="[&_tr]:border-border bg-muted/50">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-foreground/80">名称</TableHead>
                                <TableHead className="text-foreground/80">状态</TableHead>
                                <TableHead className="text-foreground/80">更新时间</TableHead>
                                <TableHead className="text-right text-foreground/80">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedKeys.map((key) => (
                                <TableRow key={key.id} className="border-border hover:bg-accent/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center">
                                                <KeyRound className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">{key.name}</span>
                                                <span className="text-xs text-muted-foreground">{key.id}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={key.has_api_key ? 'default' : 'secondary'} className={key.has_api_key ? 'bg-green-500/20 text-green-200 hover:bg-green-500/20' : 'bg-gray-500/20 text-gray-200 hover:bg-gray-500/20'}>
                                            {key.has_api_key ? '已配置' : '未配置'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{key.updated_at || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="outline" size="sm" className="border-border bg-muted/50 text-foreground hover:bg-accent/50 hover:text-foreground" onClick={() => openEditDialog(key)}>
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" className="border-red-300/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100" onClick={() => handleDelete(key)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[560px] bg-card backdrop-blur-xl border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>{editingKey ? '编辑 API Key' : '新增 API Key'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">配置ID（可选）</p>
                            <Input
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                                value={form.id}
                                onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))}
                                autoComplete="off"
                            />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">显示名称</p>
                            <Input
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                                value={form.name}
                                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                                autoComplete="off"
                            />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                            <p className="text-sm text-muted-foreground">API Key {editingKey ? '(留空表示不修改)' : ''}</p>
                            <Input
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                                value={form.api_key}
                                type="password"
                                onChange={(e) => setForm((s) => ({ ...s, api_key: e.target.value }))}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" className="border-border bg-muted/50 text-foreground hover:bg-accent/50 hover:text-foreground" onClick={() => setDialogOpen(false)} disabled={saving}>取消</Button>
                        <Button className="bg-accent/50 border border-border text-foreground hover:bg-accent" onClick={handleSubmit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingKey ? '保存修改' : '创建 API Key'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}