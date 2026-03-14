from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from .database import Base

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    linkedin_url = Column(Text, unique=True, nullable=False)
    full_name = Column(Text, nullable=False)
    first_name = Column(Text)
    last_name = Column(Text)
    job_title = Column(Text)
    company = Column(Text)
    company_website = Column(Text)
    email = Column(Text)
    email_source = Column(Text, default="Apollo")
    phone = Column(Text)
    phone_type = Column(Text)
    profile_photo_url = Column(Text)
    headline = Column(Text)
    about = Column(Text)
    location = Column(Text)
    experience = Column(Text)
    education = Column(Text)
    services = Column(Text)
    date_added = Column(DateTime, default=datetime.utcnow)

    lists = relationship("List", secondary="list_contacts", back_populates="contacts")


class List(Base):
    __tablename__ = "lists"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contacts = relationship(
        "Contact", secondary="list_contacts", back_populates="lists"
    )


list_contacts = Table(
    "list_contacts",
    Base.metadata,
    Column("list_id", String(36), ForeignKey("lists.id"), primary_key=True),
    Column(
        "contact_id", String(36), ForeignKey("contacts.id"), primary_key=True
    ),
)
