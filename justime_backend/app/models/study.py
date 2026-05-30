"""
考研学习相关数据模型
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

SubjectType = Literal["数学", "英语", "政治", "专业课"]
TaskStatus = Literal["pending", "in_progress", "completed", "skipped"]
TaskType = Literal["study", "review", "practice", "mock_exam"]


class PlanPhase(BaseModel):
    phaseName: str = Field(..., max_length=100, description="阶段名称")
    startDate: datetime = Field(..., description="阶段开始日期")
    endDate: datetime = Field(..., description="阶段结束日期")
    subjects: List[SubjectType] = Field(default_factory=list, description="涉及科目")
    goals: List[str] = Field(default_factory=list, description="阶段目标")


class StudyProfileBase(BaseModel):
    targetSchool: str = Field(..., max_length=200, description="目标院校")
    targetMajor: str = Field(..., max_length=200, description="目标专业")
    examDate: datetime = Field(..., description="考试日期")
    subjects: List[SubjectType] = Field(default_factory=list, description="考试科目")
    dailyStudyHours: float = Field(8.0, ge=1.0, le=16.0, description="每日学习时长(小时)")


class StudyProfileCreate(StudyProfileBase):
    pass


class StudyProfileUpdate(BaseModel):
    targetSchool: Optional[str] = Field(None, max_length=200)
    targetMajor: Optional[str] = Field(None, max_length=200)
    examDate: Optional[datetime] = None
    subjects: Optional[List[SubjectType]] = None
    dailyStudyHours: Optional[float] = Field(None, ge=1.0, le=16.0)


class StudyProfileOut(StudyProfileBase):
    id: str
    userId: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class StudyPlanBase(BaseModel):
    planName: str = Field(..., max_length=200, description="计划名称")
    startDate: datetime = Field(..., description="计划开始日期")
    endDate: datetime = Field(..., description="计划结束日期")
    phases: List[PlanPhase] = Field(default_factory=list, description="计划阶段")
    dailyHours: float = Field(8.0, ge=1.0, le=16.0, description="每日学习时长(小时)")


class StudyPlanCreate(StudyPlanBase):
    pass


class StudyPlanUpdate(BaseModel):
    planName: Optional[str] = Field(None, max_length=200)
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    phases: Optional[List[PlanPhase]] = None
    dailyHours: Optional[float] = Field(None, ge=1.0, le=16.0)


class StudyPlanOut(StudyPlanBase):
    id: str
    userId: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class StudyTaskBase(BaseModel):
    subject: SubjectType = Field(..., description="科目")
    taskType: TaskType = Field(..., description="任务类型")
    title: str = Field(..., max_length=200, description="任务标题")
    description: str = Field("", max_length=2000, description="任务描述")
    scheduledDate: datetime = Field(..., description="计划日期")
    durationHours: float = Field(1.0, ge=0.5, le=12.0, description="预计时长(小时)")
    feishuEventId: Optional[str] = Field(None, max_length=100, description="飞书日历事件ID")


class StudyTaskCreate(StudyTaskBase):
    planId: Optional[str] = Field(None, max_length=100, description="关联计划ID")


class StudyTaskUpdate(BaseModel):
    subject: Optional[SubjectType] = None
    taskType: Optional[TaskType] = None
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    scheduledDate: Optional[datetime] = None
    durationHours: Optional[float] = Field(None, ge=0.5, le=12.0)
    status: Optional[TaskStatus] = None
    feishuEventId: Optional[str] = Field(None, max_length=100)


class StudyTaskOut(StudyTaskBase):
    id: str
    userId: str
    planId: Optional[str] = None
    status: TaskStatus = "pending"
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class StudyProgressBase(BaseModel):
    date: datetime = Field(..., description="日期")
    subject: SubjectType = Field(..., description="科目")
    plannedHours: float = Field(..., ge=0.0, description="计划时长(小时)")
    actualHours: float = Field(0.0, ge=0.0, description="实际时长(小时)")
    completionRate: float = Field(0.0, ge=0.0, le=1.0, description="完成率 0-1")
    notes: str = Field("", max_length=2000, description="备注")


class StudyProgressCreate(StudyProgressBase):
    pass


class StudyProgressOut(StudyProgressBase):
    id: str
    userId: str
    createdAt: Optional[datetime] = None


class ReviewScheduleBase(BaseModel):
    knowledgePoint: str = Field(..., max_length=500, description="知识点")
    subject: SubjectType = Field(..., description="科目")
    lastReviewed: Optional[datetime] = Field(None, description="上次复习时间")
    nextReview: datetime = Field(..., description="下次复习时间")
    reviewCount: int = Field(0, ge=0, description="复习次数")
    easeFactor: float = Field(2.5, ge=1.3, le=5.0, description="SM-2 难度因子")


class ReviewScheduleCreate(ReviewScheduleBase):
    pass


class ReviewScheduleOut(ReviewScheduleBase):
    id: str
    userId: str
    createdAt: Optional[datetime] = None


class StudyMaterialBase(BaseModel):
    subject: SubjectType = Field(..., description="科目")
    filename: str = Field(..., max_length=500, description="文件名")
    notebooklmSourceId: Optional[str] = Field(None, max_length=200, description="NotebookLM 来源ID")


class StudyMaterialCreate(StudyMaterialBase):
    pass


class StudyMaterialOut(StudyMaterialBase):
    id: str
    userId: str
    uploadedAt: Optional[datetime] = None
