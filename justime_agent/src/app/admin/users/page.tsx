'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    Search,
    Trash2,
    MoreHorizontal,
    Shield,
    ShieldCheck,
    User,
    Loader2,
    Ban,
    CheckCircle2
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

interface AdminUser {
    id: string
    username: string
    email: string
    role: string
    status: string
    access_all_models: boolean
    allowed_model_ids: string[]
    created_at: string
    last_login: string
}

interface AdminModel {
    id: string
    name: string
    model_id: string
    enabled: boolean
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [models, setModels] = useState<AdminModel[]>([])
    const [modelDialogOpen, setModelDialogOpen] = useState(false)
    const [modelDialogLoading, setModelDialogLoading] = useState(false)
    const [modelDialogSaving, setModelDialogSaving] = useState(false)
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
    const [accessAllModels, setAccessAllModels] = useState(true)
    const [allowedModelIds, setAllowedModelIds] = useState<string[]>([])
    const { toast } = useToast()
    const { user: currentUser } = useAuth()

    const fetchUsers = async () => {
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.USERS)
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error || result.message || '获取用户列表失败')
            }

            const rows = Array.isArray(result?.data) ? result.data : []
            setUsers(rows)
        } catch (error) {
            console.error('Failed to fetch users:', error)
            toast({
                title: "获取用户列表失败",
                description: error instanceof Error ? error.message : "请检查网络连接或稍后重试",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('确定要删除该用户吗？此操作无法撤销。')) return

        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.USER(userId), {
                method: 'DELETE'
            })
            const result = await response.json()

            if (response.ok) {
                toast({
                    title: "用户删除成功",
                    className: "bg-green-50 border-green-200 text-green-800"
                })
                fetchUsers()
            } else {
                toast({
                    title: "删除失败",
                    description: result.error || result.message || "操作无法完成",
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "请求失败",
                description: "发生网络错误",
                variant: "destructive"
            })
        }
    }

    const handleUpdateRole = async (userId: string, role: 'admin' | 'user') => {
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.USER_ROLE(userId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '更新角色失败')

            toast({
                title: "角色更新成功",
                className: "bg-green-50 border-green-200 text-green-800"
            })
            fetchUsers()
        } catch (error) {
            toast({
                title: "更新角色失败",
                description: error instanceof Error ? error.message : "操作无法完成",
                variant: "destructive"
            })
        }
    }

    const handleUpdateStatus = async (userId: string, status: 'active' | 'banned') => {
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.USER_STATUS(userId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '更新状态失败')

            toast({
                title: "状态更新成功",
                className: "bg-green-50 border-green-200 text-green-800"
            })
            fetchUsers()
        } catch (error) {
            toast({
                title: "更新状态失败",
                description: error instanceof Error ? error.message : "操作无法完成",
                variant: "destructive"
            })
        }
    }

    const openModelAccessDialog = async (targetUser: AdminUser) => {
        setSelectedUser(targetUser)
        setAccessAllModels(Boolean(targetUser.access_all_models))
        setAllowedModelIds(Array.isArray(targetUser.allowed_model_ids) ? targetUser.allowed_model_ids : [])
        setModelDialogLoading(true)
        setModelDialogOpen(true)

        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.MODELS)
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '获取模型列表失败')
            const rows = Array.isArray(result?.data) ? result.data : []
            setModels(rows.filter((item: AdminModel) => item.enabled !== false))
        } catch (error) {
            toast({
                title: "加载模型列表失败",
                description: error instanceof Error ? error.message : "请稍后重试",
                variant: "destructive"
            })
        } finally {
            setModelDialogLoading(false)
        }
    }

    const toggleAllowedModel = (modelId: string, checked: boolean) => {
        setAllowedModelIds((prev) => {
            if (checked) {
                if (prev.includes(modelId)) return prev
                return [...prev, modelId]
            }
            return prev.filter((item) => item !== modelId)
        })
    }

    const saveModelAccess = async () => {
        if (!selectedUser) return
        if (!accessAllModels && allowedModelIds.length === 0) {
            toast({
                title: "请选择至少一个模型",
                description: '关闭"允许访问所有模型"后，必须至少勾选一个模型。',
                variant: "destructive"
            })
            return
        }

        setModelDialogSaving(true)
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.USER_MODELS(selectedUser.id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_all_models: accessAllModels,
                    allowed_model_ids: allowedModelIds
                })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || '更新用户模型权限失败')

            toast({
                title: "模型权限更新成功",
                className: "bg-green-50 border-green-200 text-green-800"
            })
            setModelDialogOpen(false)
            fetchUsers()
        } catch (error) {
            toast({
                title: "保存失败",
                description: error instanceof Error ? error.message : "请稍后重试",
                variant: "destructive"
            })
        } finally {
            setModelDialogSaving(false)
        }
    }

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (value: string) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return '-'
        return date.toLocaleDateString()
    }

    const selectedModelSet = useMemo(() => new Set(allowedModelIds), [allowedModelIds])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">用户管理</h2>
                    <p className="text-muted-foreground">
                        查看并管理系统中的所有注册用户
                    </p>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索用户..."
                        className="pl-9 w-full sm:w-[300px] bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:border-ring focus-visible:ring-offset-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/30 backdrop-blur-xl shadow-2xl overflow-hidden text-foreground w-full">
                <Table className="text-foreground">
                    <TableHeader className="[&_tr]:border-border bg-muted/50">
                        <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground">用户</TableHead>
                            <TableHead className="text-muted-foreground">角色</TableHead>
                            <TableHead className="text-muted-foreground">状态</TableHead>
                            <TableHead className="text-muted-foreground">模型权限</TableHead>
                            <TableHead className="text-muted-foreground">注册时间</TableHead>
                            <TableHead className="text-muted-foreground">最后登录</TableHead>
                            <TableHead className="text-right text-muted-foreground">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 ? (
                            <TableRow className="border-border hover:bg-transparent">
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    没有找到匹配的用户
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="border-border hover:bg-accent/50">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{user.username}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {user.role === 'admin' ? (
                                                <Shield className="w-3 h-3 text-blue-300" />
                                            ) : (
                                                <User className="w-3 h-3 text-muted-foreground" />
                                            )}
                                            <span className={`text-sm ${user.role === 'admin' ? 'text-blue-200 font-medium' : 'text-muted-foreground'}`}>
                                                {user.role === 'admin' ? '管理员' : '普通用户'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className={user.status === 'active' ? 'bg-green-500/20 text-green-200 hover:bg-green-500/20' : 'bg-gray-500/20 text-gray-200 hover:bg-gray-500/20'}>
                                            {user.status === 'active' ? '活跃' : '封禁'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.access_all_models ? (
                                            <Badge className="bg-blue-500/20 text-blue-200 hover:bg-blue-500/20">全部模型</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-muted/50 text-muted-foreground hover:bg-muted/50">
                                                已限制（{Array.isArray(user.allowed_model_ids) ? user.allowed_model_ids.length : 0}）
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {formatDate(user.created_at)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {formatDate(user.last_login)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent/50">
                                                    <span className="sr-only">打开菜单</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-popover/90 backdrop-blur-xl border-border text-foreground">
                                                <DropdownMenuLabel className="text-foreground">操作</DropdownMenuLabel>
                                                <DropdownMenuItem className="focus:bg-accent/50 focus:text-foreground" onClick={() => navigator.clipboard.writeText(user.id)}>
                                                    复制用户ID
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="focus:bg-accent/50 focus:text-foreground"
                                                    onClick={() => openModelAccessDialog(user)}
                                                >
                                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                                    配置模型权限
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="focus:bg-accent/50 focus:text-foreground"
                                                    onClick={() => handleUpdateRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
                                                    disabled={currentUser?.id === user.id}
                                                >
                                                    {user.role === 'admin' ? (
                                                        <>
                                                            <User className="mr-2 h-4 w-4" />
                                                            降级为普通用户
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Shield className="mr-2 h-4 w-4" />
                                                            提升为管理员
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="focus:bg-accent/50 focus:text-foreground"
                                                    onClick={() => handleUpdateStatus(user.id, user.status === 'active' ? 'banned' : 'active')}
                                                    disabled={currentUser?.id === user.id}
                                                >
                                                    {user.status === 'active' ? (
                                                        <>
                                                            <Ban className="mr-2 h-4 w-4" />
                                                            封禁账户
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                                            启用账户
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-border" />
                                                <DropdownMenuItem
                                                    className="text-red-300 focus:bg-red-500/20 focus:text-red-200"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    disabled={currentUser?.id === user.id}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    删除用户
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
                <DialogContent className="sm:max-w-[640px] bg-popover/90 backdrop-blur-xl border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>配置模型权限：{selectedUser?.username || '-'}</DialogTitle>
                    </DialogHeader>

                    {modelDialogLoading ? (
                        <div className="py-10 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="rounded-md border border-border bg-muted/50 px-3 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-foreground">允许访问所有模型</p>
                                    <p className="text-xs text-muted-foreground mt-1">关闭后仅允许访问下方勾选模型。</p>
                                </div>
                                <Switch checked={accessAllModels} onCheckedChange={setAccessAllModels} />
                            </div>

                            {!accessAllModels && (
                                <div className="rounded-md border border-border bg-muted/50 p-3 max-h-72 overflow-y-auto space-y-2">
                                    {models.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">当前没有可分配模型。</p>
                                    ) : (
                                        models.map((model) => (
                                            <label key={model.id} className="flex items-start gap-3 py-1">
                                                <Checkbox
                                                    checked={selectedModelSet.has(model.id)}
                                                    onCheckedChange={(checked) => toggleAllowedModel(model.id, checked === true)}
                                                />
                                                <span className="text-sm text-foreground">
                                                    {model.name}
                                                    <span className="ml-2 text-xs text-muted-foreground">{model.model_id}</span>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="border-border bg-muted/50 text-foreground hover:bg-accent/50 hover:text-foreground"
                            onClick={() => setModelDialogOpen(false)}
                            disabled={modelDialogSaving}
                        >
                            取消
                        </Button>
                        <Button
                            className="bg-accent/50 border border-border text-foreground hover:bg-accent/70"
                            onClick={saveModelAccess}
                            disabled={modelDialogSaving || modelDialogLoading}
                        >
                            {modelDialogSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            保存权限
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}