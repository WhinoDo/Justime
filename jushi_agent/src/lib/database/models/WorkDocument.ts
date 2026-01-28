/**
 * 工作文档数据模型
 */

import mongoose, { Document, Schema } from 'mongoose'

export interface IWorkDocument extends Document {
    _id: string
    userId: string           // 用户ID
    eventId: string          // 关联的日程事件ID
    content: string          // Markdown内容
    version: number          // 版本号
    lastSavedAt: Date        // 最后保存时间

    // 元数据
    createdAt: Date
    updatedAt: Date
}

const workDocumentSchema = new Schema<IWorkDocument>({
    userId: {
        type: String,
        required: true,
        index: true
    },
    eventId: {
        type: String,
        required: true,
        unique: true, // 一个事件对应一个文档
        index: true
    },
    content: {
        type: String,
        default: ''
    },
    version: {
        type: Number,
        default: 1
    },
    lastSavedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'work_documents'
})

// 索引
if (typeof window === 'undefined') {
    workDocumentSchema.index({ userId: 1, eventId: 1 })
}

// 导出模型
export const WorkDocument = (typeof window === 'undefined')
    ? (mongoose.models.WorkDocument || mongoose.model<IWorkDocument>('WorkDocument', workDocumentSchema))
    : null as any

export default WorkDocument
