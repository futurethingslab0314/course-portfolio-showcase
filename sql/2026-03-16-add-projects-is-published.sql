alter table public.projects
add column if not exists is_published boolean;

update public.projects
set is_published = false
where is_published is null;

alter table public.projects
alter column is_published set default false;

alter table public.projects
alter column is_published set not null;

create index if not exists idx_projects_course_published
on public.projects(course_id, is_published, "order");
