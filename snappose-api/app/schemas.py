from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: int
    slug: str
    name: str
    icon: str | None = None
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    slug: str
    name: str
    icon: str | None = None
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    slug: str | None = None
    name: str | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class PoseOut(BaseModel):
    id: int
    category_id: int
    name: str
    photo_url: str
    skeleton_url: str
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


class PoseCreate(BaseModel):
    category_id: int
    name: str
    photo_url: str
    skeleton_url: str
    sort_order: int = 0
    is_active: bool = True


class PoseUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    photo_url: str | None = None
    skeleton_url: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UploadResponse(BaseModel):
    url: str
