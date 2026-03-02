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
            const response = await fetch('/api/admin/users')
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
            const response = await fetch(`/api/admin/users/${userId}`, {
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
            const response = await fetch(`/api/admin/users/${userId}/role`, {
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
            const response = await fetch(`/api/admin/users/${userId}/status`, {
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
            const response = await fetch('/api/admin/models')
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
                description: "关闭“允许访问所有模型”后，必须至少勾选一个模型。",
                variant: "destructive"
            })
            return
        }

        setModelDialogSaving(true)
        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}/models`, {
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
                <Loader2 className="w-8 h-8 animate-spin text-white/80" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">用户管理</h2>
                    <p className="text-white/70">
                        查看并管理系统中的所有注册用户
                    </p>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/50" />
                    <Input
                        placeholder="搜索用户..."
                        className="pl-9 w-full sm:w-[300px] bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 focus-visible:ring-offset-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden text-white w-full">
                <Table className="text-white">
                    <TableHeader className="[&_tr]:border-white/10 bg-white/5">
                        <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-white/80">用户</TableHead>
                            <TableHead className="text-white/80">角色</TableHead>
                            <TableHead className="text-white/80">状态</TableHead>
                            <TableHead className="text-white/80">模型权限</TableHead>
                            <TableHead className="text-white/80">注册时间</TableHead>
                            <TableHead className="text-white/80">最后登录</TableHead>
                            <TableHead className="text-right text-white/80">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 ? (
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableCell colSpan={7} className="h-24 text-center text-white/60">
                                    没有找到匹配的用户
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">{user.username}</span>
                                            <span className="text-xs text-white/60">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {user.role === 'admin' ? (
                                                <Shield className="w-3 h-3 text-blue-300" />
                                            ) : (
                                                <User className="w-3 h-3 text-white/50" />
                                            )}
                                            <span className={`text-sm ${user.role === 'admin' ? 'text-blue-200 font-medium' : 'text-white/70'}`}>
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
                                            <Badge variant="secondary" className="bg-white/10 text-white/80 hover:bg-white/10">
                                                已限制（{Array.isArray(user.allowed_model_ids) ? user.allowed_model_ids.length : 0}）
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-white/60 text-sm">
                                        {formatDate(user.created_at)}
                                    </TableCell>
                                    <TableCell className="text-white/60 text-sm">
                                        {formatDate(user.last_login)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10">
                                                    <span className="sr-only">打开菜单</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-gray-900/90 backdrop-blur-xl border-white/20 text-white">
                                                <DropdownMenuLabel className="text-white">操作</DropdownMenuLabel>
                                                <DropdownMenuItem className="focus:bg-white/10 focus:text-white" onClick={() => navigator.clipboard.writeText(user.id)}>
                                                    复制用户ID
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="focus:bg-white/10 focus:text-white"
                                                    onClick={() => openModelAccessDialog(user)}
                                                >
                                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                                    配置模型权限
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="focus:bg-white/10 focus:text-white"
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
                                                    className="focus:bg-white/10 focus:text-white"
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
                                                <DropdownMenuSeparator className="bg-white/10" />
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
                <DialogContent className="sm:max-w-[640px] bg-gray-900/90 backdrop-blur-xl border-white/20 text-white">
                    <DialogHeader>
                        <DialogTitle>配置模型权限：{selectedUser?.username || '-'}</DialogTitle>
                    </DialogHeader>

                    {modelDialogLoading ? (
                        <div className="py-10 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-white/80" />
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="rounded-md border border-white/15 bg-black/20 px-3 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white">允许访问所有模型</p>
                                    <p className="text-xs text-white/60 mt-1">关闭后仅允许访问下方勾选模型。</p>
                                </div>
                                <Switch checked={accessAllModels} onCheckedChange={setAccessAllModels} />
                            </div>

                            {!accessAllModels && (
                                <div className="rounded-md border border-white/15 bg-black/20 p-3 max-h-72 overflow-y-auto space-y-2">
                                    {models.length === 0 ? (
                                        <p className="text-xs text-white/60">当前没有可分配模型。</p>
                                    ) : (
                                        models.map((model) => (
                                            <label key={model.id} className="flex items-start gap-3 py-1">
                                                <Checkbox
                                                    checked={selectedModelSet.has(model.id)}
                                                    onCheckedChange={(checked) => toggleAllowedModel(model.id, checked === true)}
                                                />
                                                <span className="text-sm text-white">
                                                    {model.name}
                                                    <span className="ml-2 text-xs text-white/60">{model.model_id}</span>
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
                            className="border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white"
                            onClick={() => setModelDialogOpen(false)}
                            disabled={modelDialogSaving}
                        >
                            取消
                        </Button>
                        <Button
                            className="bg-white/20 border border-white/20 text-white hover:bg-white/30"
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
