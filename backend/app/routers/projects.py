from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import base64
from app.database import get_db
from app.models import Project, ProjectMember, User, ProjectFile
from app.schemas import ProjectCreate, ProjectOut
from app.auth import get_current_user, require_manager

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("/", response_model=ProjectOut, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    project = Project(name=data.name, description=data.description, manager_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    result = await db.execute(
        select(Project).options(selectinload(Project.manager)).where(Project.id == project.id)
    )
    return result.scalar_one()

@router.get("/", response_model=List[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "manager":
        result = await db.execute(
            select(Project).options(selectinload(Project.manager))
            .where(Project.manager_id == current_user.id, Project.is_active == True)
        )
    else:
        result = await db.execute(
            select(Project).join(ProjectMember, ProjectMember.project_id == Project.id)
            .options(selectinload(Project.manager))
            .where(ProjectMember.user_id == current_user.id, Project.is_active == True)
        )
    return result.scalars().all()

@router.post("/{project_id}/members/{user_id}")
async def add_member(
    project_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.manager_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    member = ProjectMember(project_id=project_id, user_id=user_id)
    db.add(member)
    await db.commit()
    return {"message": "Member added"}

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.manager_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.is_active = False
    await db.commit()
    return {"message": "Project deleted"}

# ── Project Files ──────────────────────────────────────────────────────────

async def _get_project(project_id: int, db: AsyncSession, user: User):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.is_active == True))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role != "manager" and project.manager_id != user.id:
        member = await db.execute(select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
        ))
        if not member.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not a project member")
    return project

@router.post("/{project_id}/files")
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    await _get_project(project_id, db, current_user)
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    pf = ProjectFile(
        project_id=project_id,
        uploader_id=current_user.id,
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        file_data=base64.b64encode(raw).decode(),
        file_size=len(raw),
    )
    db.add(pf)
    await db.commit()
    await db.refresh(pf)
    return {
        "id": pf.id, "filename": pf.filename, "content_type": pf.content_type,
        "file_size": pf.file_size, "created_at": pf.created_at,
        "uploader_name": current_user.name,
    }

@router.get("/{project_id}/files")
async def list_files(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _get_project(project_id, db, current_user)
    result = await db.execute(
        select(ProjectFile, User.name.label("uploader_name"))
        .join(User, ProjectFile.uploader_id == User.id)
        .where(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
    )
    return [
        {
            "id": pf.id, "filename": pf.filename, "content_type": pf.content_type,
            "file_size": pf.file_size, "created_at": pf.created_at,
            "uploader_name": uploader_name,
        }
        for pf, uploader_name in result.all()
    ]

@router.get("/{project_id}/files/{file_id}/download")
async def download_file(
    project_id: int,
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await _get_project(project_id, db, current_user)
    result = await db.execute(select(ProjectFile).where(
        ProjectFile.id == file_id, ProjectFile.project_id == project_id
    ))
    pf = result.scalar_one_or_none()
    if not pf:
        raise HTTPException(status_code=404, detail="File not found")
    raw = base64.b64decode(pf.file_data)
    return Response(
        content=raw,
        media_type=pf.content_type,
        headers={"Content-Disposition": f'attachment; filename="{pf.filename}"'},
    )

@router.delete("/{project_id}/files/{file_id}")
async def delete_file(
    project_id: int,
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(ProjectFile).where(
        ProjectFile.id == file_id, ProjectFile.project_id == project_id
    ))
    pf = result.scalar_one_or_none()
    if not pf:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(pf)
    await db.commit()
    return {"message": "File deleted"}
