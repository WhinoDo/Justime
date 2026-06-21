import { useState, useMemo } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { AdminModel, AdminApiKey } from './useModels'

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

interface ModelFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingModel: AdminModel | null
    apiKeys: AdminApiKey[]
    apiKeyNameById: Record<string, string>
    onSuccess: () => void
}

export function ModelFormDialog({
    open,
    onOpenChange,
    editingModel,
    apiKeys,
    apiKeyNameById,
    onSuccess
}: ModelFormDialogProps) {
    const [form, setForm] = useState<ModelFormState>(emptyForm)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null)
    const { toast } = useToast()

    const selectedApiKeyName = form.api_key_id ? (apiKeyNameById[form.api_key_id] || form.api_key_id) : ''

    const resetForm = (model: AdminModel | null) => {
        if (model) {
            const hasReference = !!model.api_key_id
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
        } else {
            setForm({
                ...emptyForm,
                api_key_mode: apiKeys.length > 0 ? 'reference' : 'manual',
                api_key_id: apiKeys.length > 0 ? apiKeys[0].id : ''
            })
        }
        setTestResult(null)
    }

    // Reset form when dialog opens with editing model
    useMemo(() => {
        if (open) {
            resetForm(editingModel)
        }
    }, [open, editingModel, apiKeys])

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
            const endpoint = isEdit ? `/api/admin/models/${editingModel.id}` : '/api/admin/models'
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
            onOpenChange(false)
            onSuccess()
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] bg-card backdrop-blur-xl border-border text-foreground">
                <DialogHeader>
                    <DialogTitle>{editingModel ? '编辑系统模型' : '新增系统模型'}</DialogTitle>
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
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">模型ID</p>
                        <Input
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                            value={form.model_id}
                            onChange={(e) => setForm((s) => ({ ...s, model_id: e.target.value }))}
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">服务地址</p>
                        <Input
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                            value={form.base_url}
                            onChange={(e) => setForm((s) => ({ ...s, base_url: e.target.value }))}
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                        <p className="text-sm text-muted-foreground">API Key 来源</p>
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
                            <SelectTrigger className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground">
                                <SelectValue>
                                    {form.api_key_mode === 'reference' ? '引用系统 API Key' : '手动输入独立 API Key'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                                <SelectItem value="reference">引用系统 API Key</SelectItem>
                                <SelectItem value="manual">手动输入独立 API Key</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {form.api_key_mode === 'reference' ? (
                        <div className="space-y-1 sm:col-span-2">
                            <p className="text-sm text-muted-foreground">选择系统 API Key</p>
                            <Select
                                value={form.api_key_id}
                                onValueChange={(value) => setForm((s) => ({ ...s, api_key_id: value }))}
                            >
                                <SelectTrigger className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground">
                                    <SelectValue>
                                        {selectedApiKeyName || '请选择一个系统 API Key'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
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
                            <p className="text-sm text-muted-foreground">API Key {editingModel ? '(留空表示不修改)' : ''}</p>
                            <Input
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                                value={form.api_key}
                                type="password"
                                onChange={(e) => setForm((s) => ({ ...s, api_key: e.target.value }))}
                                autoComplete="new-password"
                            />
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
                                        <span className="text-muted-foreground">({testResult.latencyMs}ms)</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Temperature</p>
                        <Input
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                            value={form.temperature}
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            onChange={(e) => setForm((s) => ({ ...s, temperature: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">优先级</p>
                        <Input
                            className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                            value={form.priority}
                            type="number"
                            min={1}
                            max={999}
                            onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <p className="text-sm text-muted-foreground">能力标签</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-border bg-muted/50 p-3">
                            {capabilityOptions.map((option) => (
                                <label key={option.value} className="flex items-center gap-3">
                                    <Checkbox
                                        checked={form.capabilities.includes(option.value)}
                                        onCheckedChange={(checked) => toggleCapability(option.value, checked === true)}
                                    />
                                    <span className="text-sm text-foreground">
                                        {option.label}
                                        <span className="ml-2 text-xs text-muted-foreground">{option.description}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-3">
                        <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((s) => ({ ...s, enabled: checked }))} />
                        <p className="text-sm text-muted-foreground">启用该模型</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" className="border-border bg-muted/50 text-foreground hover:bg-accent/50 hover:text-foreground" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
                    <Button className="bg-accent/50 border border-border text-foreground hover:bg-accent" onClick={handleSubmit} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingModel ? '保存修改' : '创建模型'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}