'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Edit2, Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
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

interface AdminModel {
    id: string
    name: string
    model_id: string
    base_url: string
    temperature: number
    capabilities: string[]
    priority: number
    enabled: boolean
    has_api_key: boolean
    api_key_id?: string
    api_key_name?: string
    updated_at?: string
}

interface AdminApiKey {
    id: string
    name: string
    has_api_key: boolean
    updated_at?: string
}

type ApiKeyMode = 'reference' | 'manual'

interface ModelFormState {
    id: string
    name: string
    model_id: string
    base_url: string
    api_key: string
    api_key_id: string
    api_key_mode: ApiKeyMode
    temperature: string
    capabilities: string[]
    priority: string
    enabled: boolean
}

const emptyForm: ModelFormState = {
    id: '',
    name: '',
    model_id: '',
    base_url: '',
    api_key: '',
    api_key_id: '',
    api_key_mode: 'manual',
    temperature: '0.7',
    capabilities: [],
    priority: '100',
    enabled: true
}

const capabilityOptions = [
    { value: 'fast', label: 'fast', description: '适合普通问答' },
    { value: 'reasoning', label: 'reasoning', description: '适合深度思考' },
    { value: 'classifier', label: 'classifier', description: '适合路由分发' },
    { value: 'tool_call', label: 'tool_call', description: '支持工具调用' }
]

export default function AdminModelsPage() {
    const [models, setModels] = useState<AdminModel[]>([])
    const [apiKeys, setApiKeys] = useState<AdminApiKey[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingModel, setEditingModel] = useState<AdminModel | null>(null)
    const [form, setForm] = useState<ModelFormState>(emptyForm)
    const { toast } = useToast()

    const sortedModels = useMemo(
        () => [...models].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
        [models]
    )

    const apiKeyNameById = useMemo(() => {
        const map: Record<string, string> = {}
        for (const item of apiKeys) {
            map[item.id] = item.name
        }
        return map
    }, [apiKeys])

    const selectedApiKeyName = form.api_key_id ? (apiKeyNameById[form.api_key_id] || form.api_key_id) : ''

    const fetchData = async () => {
        try {
            const [modelsResp, keysResp] = await Promise.all([
                fetch(API_ENDPOINTS.ADMIN.MODELS),
                fetch(API_ENDPOINTS.ADMIN.API_KEYS),
            ])
            const modelsResult = await modelsResp.json()
            const keysResult = await keysResp.json()

            if (!modelsResp.ok) {
                throw new Error(modelsResult.error || modelsResult.message || '获取模型列表失败')
            }
            if (!keysResp.ok) {
                throw new Error(keysResult.error || keysResult.message || '获取 API Key 列表失败')
            }

            setModels(Array.isArray(modelsResult?.data) ? modelsResult.data : [])
            const keyRows = Array.isArray(keysResult?.data) ? keysResult.data : []
            setApiKeys(keyRows.filter((item: AdminApiKey) => item?.has_api_key))
        } catch (error) {
            toast({
                title: '加载后台配置失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const openCreateDialog = () => {
        setEditingModel(null)
        setForm({
            ...emptyForm,
            api_key_mode: apiKeys.length > 0 ? 'reference' : 'manual',
            api_key_id: apiKeys.length > 0 ? apiKeys[0].id : ''
        })
        setTestResult(null)
        setDialogOpen(true)
    }

    const openEditDialog = (model: AdminModel) => {
        const hasReference = !!model.api_key_id
        setEditingModel(model)
        setForm({
            id: model.id,
            name: model.name,
            model_id: model.model_id,
            base_url: model.base_url,
            api_key: '',
            api_key_id: model.api_key_id || '',
            api_key_mode: hasReference ? 'reference' : 'manual',
            temperature: String(model.temperature ?? 0.7),
            capabilities: model.capabilities,
            priority: String(model.priority ?? 100),
            enabled: !!model.enabled
        })
        setTestResult(null)
        setDialogOpen(true)
    }

    const toggleCapability = (capability: string, checked: boolean) => {
        setForm((prev) => {
            const exists = prev.capabilities.includes(capability)
            if (checked && !exists) {
                return { ...prev, capabilities: [...prev.capabilities, capability] }
            }
            if (!checked && exists) {
                return {
                    ...prev,
                    capabilities: prev.capabilities.filter((item) => item !== capability)
                }
            }
            return prev
        })
    }

    const buildPayload = (forEdit: boolean) => {
        const payload: Record<string, unknown> = {
            id: form.id.trim() || undefined,
            name: form.name.trim(),
            model_id: form.model_id.trim(),
            base_url: form.base_url.trim(),
            temperature: Number(form.temperature || 0.7),
            capabilities: form.capabilities,
            priority: Number(form.priority || 100),
            enabled: form.enabled
        }

        if (form.api_key_mode === 'reference') {
            payload.api_key_id = form.api_key_id || null
            payload.api_key = ''
        } else {
            payload.api_key_id = null
            if (!forEdit || form.api_key.trim()) {
                payload.api_key = form.api_key.trim()
            }
        }

        return payload
    }

    const handleSubmit = async () => {
        if (!form.name.trim() || !form.model_id.trim() || !form.base_url.trim()) {
            toast({
                title: '表单不完整',
                description: '请填写名称、模型ID和服务地址',
                variant: 'destructive'
            })
            return
        }

        if (form.api_key_mode === 'reference' && !form.api_key_id) {
            toast({
                title: '请选择 API Key',
                description: '当前模式为引用系统 API Key，请先选择一个密钥',
                variant: 'destructive'
            })
            return
        }

        if (!editingModel && form.api_key_mode === 'manual' && !form.api_key.trim()) {
            toast({
                title: 'API Key 不能为空',
                description: '新增模型且选择手动模式时，必须填写 API Key',
                variant: 'destructive'
            })
            return
        }

        setSaving(true)
        try {
            const isEdit = !!editingModel
            const endpoint = isEdit ? API_ENDPOINTS.ADMIN.MODEL(editingModel.id) : API_ENDPOINTS.ADMIN.MODELS
            const method = isEdit ? 'PUT' : 'POST'

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(isEdit))
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '保存模型失败')

            toast({
                title: isEdit ? '模型更新成功' : '模型创建成功',
                className: 'bg-green-50 border-green-200 text-green-800'
            })
            setDialogOpen(false)
            fetchData()
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

    const handleDelete = async (model: AdminModel) => {
        if (!confirm(`确定要删除模型 "${model.name}" 吗？`)) return
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.MODEL(model.id), { method: 'DELETE' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '删除模型失败')
            toast({
                title: '模型删除成功',
                className: 'bg-green-50 border-green-200 text-green-800'
            })
            fetchData()
        } catch (error) {
            toast({
                title: '删除失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        }
    }

    const handleToggleEnabled = async (model: AdminModel, enabled: boolean) => {
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.MODEL(model.id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: model.id,
                    name: model.name,
                    model_id: model.model_id,
                    base_url: model.base_url,
                    api_key_id: model.api_key_id || null,
                    temperature: model.temperature,
                    capabilities: model.capabilities,
                    priority: model.priority,
                    enabled
                })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '更新启用状态失败')

            setModels((prev) => prev.map((item) => (item.id === model.id ? { ...item, enabled } : item)))
        } catch (error) {
            toast({
                title: '状态更新失败',
                description: error instanceof Error ? error.message : '请稍后重试',
                variant: 'destructive'
            })
        }
    }

    const handleTestConnection = async () => {
        if (!form.base_url.trim() || !form.model_id.trim()) {
            toast({
                title: '表单不完整',
                description: '请填写服务地址和模型ID',
                variant: 'destructive'
            })
            return
        }

        const hasKey = form.api_key_mode === 'reference' ? !!form.api_key_id : !!form.api_key.trim()
        if (!hasKey) {
            toast({
                title: 'API Key 未配置',
                description: '请先配置 API Key',
                variant: 'destructive'
            })
            return
        }

        setTesting(true)
        setTestResult(null)
        try {
            const payload: Record<string, unknown> = {
                base_url: form.base_url.trim(),
                model_id: form.model_id.trim()
            }
            if (form.api_key_mode === 'reference') {
                payload.api_key_id = form.api_key_id
            } else {
                payload.api_key = form.api_key.trim()
            }

            const response = await fetch('/api/admin/models/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const result = await response.json()

            setTestResult({
                success: result.success,
                message: result.message || (result.success ? '连接成功' : '连接失败'),
                latencyMs: result.latency_ms
            })
        } catch (error) {
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : '测试请求失败'
            })
        } finally {
            setTesting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-white/80" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">系统模型管理</h2>
                    <p className="text-white/70">管理平台全局 LLM 模型配置（新增、编辑、启用、删除）</p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2 bg-white/20 border border-white/20 text-white hover:bg-white/30">
                    <Plus className="w-4 h-4" />
                    新增模型
                </Button>
            </div>

            {sortedModels.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 backdrop-blur-xl p-10 text-center">
                    <p className="text-white/80 text-sm">当前还没有系统模型配置</p>
                    <p className="text-white/60 text-xs mt-2">点击下方按钮添加首个模型后，普通用户即可在模型配置页看到它。</p>
                    <Button onClick={openCreateDialog} className="gap-2 mt-5 bg-white/20 border border-white/20 text-white hover:bg-white/30">
                        <Plus className="w-4 h-4" />
                        添加首个模型
                    </Button>
                </div>
            ) : (
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
                            {sortedModels.map((model) => (
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
                                            onCheckedChange={(checked) => handleToggleEnabled(model, checked)}
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
                                            <Button variant="outline" size="sm" className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white" onClick={() => openEditDialog(model)}>
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" className="border-red-300/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100" onClick={() => handleDelete(model)}>
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
                <DialogContent className="sm:max-w-[620px] bg-gray-900/90 backdrop-blur-xl border-white/20 text-white">
                    <DialogHeader>
                        <DialogTitle>{editingModel ? '编辑系统模型' : '新增系统模型'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                        <div className="space-y-1">
                            <p className="text-sm text-white/70">配置ID（可选）</p>
                            <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.id} onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))} autoComplete="off" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/70">显示名称</p>
                            <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} autoComplete="off" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/70">模型ID</p>
                            <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.model_id} onChange={(e) => setForm((s) => ({ ...s, model_id: e.target.value }))} autoComplete="off" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/70">服务地址</p>
                            <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.base_url} onChange={(e) => setForm((s) => ({ ...s, base_url: e.target.value }))} autoComplete="off" />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                            <p className="text-sm text-white/70">API Key 来源</p>
                            <Select
                                value={form.api_key_mode}
                                onValueChange={(value) => {
                                    const mode = value as ApiKeyMode
                                    setForm((prev) => ({
                                        ...prev,
                                        api_key_mode: mode,
                                        api_key_id: mode === 'reference'
                                            ? (prev.api_key_id || apiKeys[0]?.id || '')
                                            : '',
                                    }))
                                }}
                            >
                                <SelectTrigger className="bg-black/20 border-white/20 text-white placeholder:text-white/50">
                                    <SelectValue>
                                        {form.api_key_mode === 'reference' ? '引用系统 API Key' : '手动输入独立 API Key'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-white/20">
                                    <SelectItem value="reference">引用系统 API Key</SelectItem>
                                    <SelectItem value="manual">手动输入独立 API Key</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {form.api_key_mode === 'reference' ? (
                            <div className="space-y-1 sm:col-span-2">
                                <p className="text-sm text-white/70">选择系统 API Key</p>
                                <Select
                                    value={form.api_key_id}
                                    onValueChange={(value) => setForm((s) => ({ ...s, api_key_id: value }))}
                                >
                                    <SelectTrigger className="bg-black/20 border-white/20 text-white placeholder:text-white/50">
                                        <SelectValue>
                                            {selectedApiKeyName || '请选择一个系统 API Key'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-900 border-white/20">
                                        {apiKeys.length === 0 ? (
                                            <SelectItem value="">暂无可用 API Key，请先在 API Key 管理中创建</SelectItem>
                                        ) : (
                                            apiKeys.map((key) => (
                                                <SelectItem key={key.id} value={key.id}>
                                                    {key.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-1 sm:col-span-2">
                                <p className="text-sm text-white/70">API Key {editingModel ? '(留空表示不修改)' : ''}</p>
                                <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.api_key} type="password" onChange={(e) => setForm((s) => ({ ...s, api_key: e.target.value }))} autoComplete="new-password" />
                            </div>
                        )}

                        <div className="sm:col-span-2 space-y-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="border-blue-400/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 hover:text-blue-100 gap-2"
                                onClick={handleTestConnection}
                                disabled={testing}
                            >
                                {testing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Zap className="w-4 h-4" />
                                )}
                                测试连接
                            </Button>
                            {testResult && (
                                <div className={`p-3 rounded-md text-sm ${testResult.success ? 'bg-green-500/20 border border-green-400/30 text-green-200' : 'bg-red-500/20 border border-red-400/30 text-red-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <span>{testResult.success ? '✓' : '✗'}</span>
                                        <span>{testResult.message}</span>
                                        {testResult.latencyMs !== undefined && (
                                            <span className="text-white/60">({testResult.latencyMs}ms)</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <p className="text-sm text-white/70">Temperature</p>
                            <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.temperature} type="number" min={0} max={2} step={0.1} onChange={(e) => setForm((s) => ({ ...s, temperature: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-white/70">优先级</p>
                            <Input className="bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0" value={form.priority} type="number" min={1} max={999} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <p className="text-sm text-white/70">能力标签</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-white/[0.15] bg-black/20 p-3">
                                {capabilityOptions.map((option) => (
                                    <label key={option.value} className="flex items-center gap-3">
                                        <Checkbox
                                            checked={form.capabilities.includes(option.value)}
                                            onCheckedChange={(checked) => toggleCapability(option.value, checked === true)}
                                        />
                                        <span className="text-sm text-white">
                                            {option.label}
                                            <span className="ml-2 text-xs text-white/60">{option.description}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-3">
                            <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((s) => ({ ...s, enabled: checked }))} />
                            <p className="text-sm text-white/70">启用该模型</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white" onClick={() => setDialogOpen(false)} disabled={saving}>取消</Button>
                        <Button className="bg-white/20 border border-white/20 text-white hover:bg-white/30" onClick={handleSubmit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingModel ? '保存修改' : '创建模型'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
