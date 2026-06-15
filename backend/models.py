# models.py
# Pydantic Schemas for MailExplorer APIs

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AttachmentSchema(BaseModel):
    id: str
    email_id: str
    filename: str
    mime_type: str
    size: int
    raw_offset: Optional[int] = None

    class Config:
        from_attributes = True

class EmailListSchema(BaseModel):
    id: str
    mailbox_id: str
    folder_path: str
    subject: Optional[str] = None
    sender: Optional[str] = None
    recipients: List[str] = []
    cc: List[str] = []
    bcc: List[str] = []
    date_ts: int
    is_read: bool = False
    importance: str = "normal"
    has_attach: bool = False
    raw_offset: Optional[int] = None
    raw_size: Optional[int] = None
    body_preview: Optional[str] = None

class EmailDetailSchema(BaseModel):
    id: str
    mailbox_id: str
    folder_path: str
    subject: Optional[str] = None
    sender: Optional[str] = None
    recipients: List[str] = []
    cc: List[str] = []
    bcc: List[str] = []
    date_ts: int
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    is_read: bool = False
    importance: str = "normal"
    has_attach: bool = False
    raw_offset: Optional[int] = None
    raw_size: Optional[int] = None
    parse_error: Optional[str] = None
    attachments: List[AttachmentSchema] = []

class FolderSchema(BaseModel):
    id: str
    mailbox_id: str
    name: str
    full_path: str
    parent_id: Optional[str] = None
    total_count: int = 0
    unread_count: int = 0
    children: List['FolderSchema'] = []

class MailboxSchema(BaseModel):
    id: str
    name: str
    file_path: str
    file_size: int
    file_format: str
    created_at: int
    last_opened: int

class OpenMailboxRequest(BaseModel):
    path: str

class OpenMailboxResponse(BaseModel):
    mailbox_id: str
    job_id: str
    format: str

class JobStatusSchema(BaseModel):
    id: str
    mailbox_id: str
    status: str
    progress: float
    total_msgs: int
    indexed_msgs: int
    error_msg: Optional[str] = None
    created_at: int
    updated_at: int

class ParseErrorSchema(BaseModel):
    id: str
    mailbox_id: str
    folder_path: Optional[str] = None
    message_index: Optional[int] = None
    error_type: str
    error_detail: str
    raw_preview: Optional[str] = None
    created_at: int

class HighlightSchema(BaseModel):
    id: str
    email_id: str
    start_pos: int
    end_pos: int
    color: str
    note: Optional[str] = None
    created_at: int

class CreateHighlightRequest(BaseModel):
    start_pos: int
    end_pos: int
    color: str = "yellow"
    note: Optional[str] = None

class TagSchema(BaseModel):
    id: str
    name: str
    color: str
    created_at: Optional[int] = None

class CreateTagRequest(BaseModel):
    name: str
    color: str = "blue"

class AssignTagRequest(BaseModel):
    tag_id: str

# ── Auth ──

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: 'UserSchema'

class UserSchema(BaseModel):
    id: str
    username: str
    role: str
    created_at: int
    expires_at: Optional[int] = None

# ── Admin ──

class SuperadminLoginRequest(BaseModel):
    password: str

class CreateBetaUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6)
    expires_at: Optional[int] = None  # unix timestamp, null = never

class UpdateUserRequest(BaseModel):
    expires_at: Optional[int] = None
    role: Optional[str] = None

# ── Notifications ──

class NotificationSchema(BaseModel):
    id: str
    title: str
    message: str
    type: str
    created_at: int
    read: bool = False

class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    type: str = "info"
