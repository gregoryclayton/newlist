from fastapi import FastAPI, APIRouter, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
from datetime import datetime
import base64
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class ContentItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # 'text', 'image', 'audio', 'video'
    title: str
    content: str  # For text content or base64 encoded media
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    bio: Optional[str] = None
    avatar: Optional[str] = None  # base64 encoded image
    content_items: List[ContentItem] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserProfileCreate(BaseModel):
    name: str
    email: str
    bio: Optional[str] = None
    avatar: Optional[str] = None

class ContentItemCreate(BaseModel):
    type: str
    title: str
    content: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Utility functions
def convert_file_to_base64(file_content: bytes) -> str:
    """Convert file content to base64 string"""
    return base64.b64encode(file_content).decode('utf-8')

def get_file_type(filename: str) -> str:
    """Determine file type based on extension"""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    
    image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
    video_extensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm']
    audio_extensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']
    
    if ext in image_extensions:
        return 'image'
    elif ext in video_extensions:
        return 'video'
    elif ext in audio_extensions:
        return 'audio'
    else:
        return 'text'

# Routes
@api_router.get("/")
async def root():
    return {"message": "User Profile API"}

# User Profile Routes
@api_router.post("/profiles", response_model=UserProfile)
async def create_user_profile(profile: UserProfileCreate):
    """Create a new user profile"""
    try:
        profile_dict = profile.dict()
        profile_obj = UserProfile(**profile_dict)
        
        # Insert into database
        result = await db.user_profiles.insert_one(profile_obj.dict())
        
        if result.inserted_id:
            return profile_obj
        else:
            raise HTTPException(status_code=500, detail="Failed to create profile")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/profiles", response_model=List[UserProfile])
async def get_user_profiles(skip: int = 0, limit: int = 10):
    """Get user profiles with pagination for infinite scroll"""
    try:
        profiles = await db.user_profiles.find().skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
        return [UserProfile(**profile) for profile in profiles]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/profiles/{profile_id}", response_model=UserProfile)
async def get_user_profile(profile_id: str):
    """Get a specific user profile"""
    try:
        profile = await db.user_profiles.find_one({"id": profile_id})
        if profile:
            return UserProfile(**profile)
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
    except HTTPException as he:
        # Re-raise HTTP exceptions as-is
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/profiles/{profile_id}/content")
async def add_content_to_profile(
    profile_id: str,
    title: str = Form(...),
    content_type: str = Form(...),
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Add content to a user profile"""
    try:
        # Find the profile
        profile = await db.user_profiles.find_one({"id": profile_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Process content
        if file:
            # Handle file upload
            file_content = await file.read()
            file_type = get_file_type(file.filename)
            base64_content = convert_file_to_base64(file_content)
            
            content_item = ContentItem(
                type=file_type,
                title=title,
                content=base64_content,
                file_name=file.filename,
                file_size=len(file_content)
            )
        else:
            # Handle text content
            content_item = ContentItem(
                type=content_type,
                title=title,
                content=text_content or ""
            )
        
        # Add content to profile
        profile_obj = UserProfile(**profile)
        profile_obj.content_items.append(content_item)
        profile_obj.updated_at = datetime.utcnow()
        
        # Update in database
        await db.user_profiles.update_one(
            {"id": profile_id},
            {"$set": profile_obj.dict()}
        )
        
        return {"message": "Content added successfully", "content_item": content_item}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/profiles/{profile_id}")
async def delete_user_profile(profile_id: str):
    """Delete a user profile"""
    try:
        result = await db.user_profiles.delete_one({"id": profile_id})
        if result.deleted_count:
            return {"message": "Profile deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# File upload route for chunked uploads
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handle file upload and return base64 encoded content"""
    try:
        # Read file content
        file_content = await file.read()
        
        # Convert to base64
        base64_content = convert_file_to_base64(file_content)
        
        # Determine file type
        file_type = get_file_type(file.filename)
        
        return {
            "filename": file.filename,
            "file_type": file_type,
            "file_size": len(file_content),
            "content": base64_content
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Original status check routes
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()