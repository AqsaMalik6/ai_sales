from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class ContactBase(BaseModel):
    linkedin_url: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    company_website: Optional[str] = None
    email: Optional[str] = None
    email_source: str = "Apollo"
    phone: Optional[str] = None
    phone_type: Optional[str] = None
    profile_photo_url: Optional[str] = None
    headline: Optional[str] = None
    about: Optional[str] = None
    location: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None
    services: Optional[str] = None


class ContactCreate(ContactBase):
    list_name: str


class Contact(ContactBase):
    id: uuid.UUID
    date_added: datetime
    lists: List["ListBase"] = []

    class Config:
        from_attributes = True


class ListBase(BaseModel):
    name: str


class ListCreate(ListBase):
    pass


class List(ListBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    contacts: List[Contact] = []

    class Config:
        from_attributes = True


class Company(BaseModel):
    name: str
    website: Optional[str]
    location: Optional[str]
    contact_count: int
