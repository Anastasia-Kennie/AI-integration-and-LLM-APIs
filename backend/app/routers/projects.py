from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.database import get_db
from app.models import Project, ProjectMember, User
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
