from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas
from .database import get_db, engine
from uuid import UUID

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LinkedIn Sales Intelligence API")

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global error: {exc}", exc_info=True)
    return HTTPException(status_code=500, detail=str(exc))

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*", 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_data(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return obj.dict()


@app.get("/api/contacts", response_model=List[schemas.Contact])
def get_contacts(db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    contacts = db.query(models.Contact).options(joinedload(models.Contact.lists)).all()
    return contacts


@app.get("/api/contacts/{contact_id}", response_model=schemas.Contact)
def get_contact(contact_id: UUID, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@app.post("/api/contacts", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    logger.info(f"Syncing profile: {contact.full_name}")
    # Check if contact exists
    existing = (
        db.query(models.Contact)
        .filter(models.Contact.linkedin_url == contact.linkedin_url)
        .first()
    )
    
    data = get_data(contact)
    contact_data = {k: v for k, v in data.items() if k != "list_name"}
    
    if existing:
        # Update existing
        for key, value in contact_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        contact_obj = existing
    else:
        contact_obj = models.Contact(**contact_data)
        db.add(contact_obj)
        db.commit()
        db.refresh(contact_obj)

    # Handle list
    list_name = contact.list_name
    list_obj = db.query(models.List).filter(models.List.name == list_name).first()
    if not list_obj:
        list_obj = models.List(name=list_name)
        db.add(list_obj)
        db.commit()
        db.refresh(list_obj)

    # Check if already in list
    if list_obj in contact_obj.lists:
        raise HTTPException(status_code=409, detail=f"Already in {list_name}")
    
    contact_obj.lists.append(list_obj)
    db.commit()

    return contact_obj


@app.delete("/api/contacts/{contact_id}/lists/{list_name}")
def remove_contact_from_list(
    contact_id: UUID, list_name: str, db: Session = Depends(get_db)
):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    list_obj = db.query(models.List).filter(models.List.name == list_name).first()
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")
    if list_obj in contact.lists:
        contact.lists.remove(list_obj)
        db.commit()
    return {"message": "Removed"}


@app.get("/api/lists", response_model=List[schemas.List])
def get_lists(db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    lists = db.query(models.List).options(joinedload(models.List.contacts)).all()
    return lists


@app.get("/api/lists/{list_name}", response_model=schemas.List)
def get_list(list_name: str, db: Session = Depends(get_db)):
    list_obj = db.query(models.List).filter(models.List.name == list_name).first()
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")
    return list_obj


@app.delete("/api/lists/{list_name}")
def delete_list(list_name: str, db: Session = Depends(get_db)):
    list_obj = db.query(models.List).filter(models.List.name == list_name).first()
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")
    db.delete(list_obj)
    db.commit()
    return {"message": "Deleted"}


@app.get("/api/companies", response_model=List[schemas.Company])
def get_companies(db: Session = Depends(get_db)):
    from sqlalchemy import func

    result = (
        db.query(
            models.Contact.company.label("name"),
            func.count(models.Contact.id).label("contact_count"),
        )
        .group_by(models.Contact.company)
        .all()
    )
    companies = []
    for row in result:
        if row.name:
            companies.append(
                schemas.Company(name=row.name, contact_count=row.contact_count)
            )
    return companies


@app.get("/api/companies/{company_name}/contacts", response_model=List[schemas.Contact])
def get_company_contacts(company_name: str, db: Session = Depends(get_db)):
    contacts = (
        db.query(models.Contact).filter(models.Contact.company == company_name).all()
    )
    return contacts
