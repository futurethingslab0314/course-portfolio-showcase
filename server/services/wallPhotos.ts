import { fetchCourseBySlug, fetchProjectsByCourse, fetchStudentWorksForProject } from './notion';
import type { NormalizationWarning } from '../../shared/contracts';

const pending=new Map<string,ReturnType<typeof loadWallPhotos>>();
export function fetchWallPhotos(existingIds: Set<string> = new Set()) {
  const key=JSON.stringify([...existingIds].sort());
  const running=pending.get(key);if(running)return running;
  const request=loadWallPhotos(existingIds).finally(()=>pending.delete(key));
  pending.set(key,request);return request;
}

async function loadWallPhotos(existingIds: Set<string>) {
  const warnings: NormalizationWarning[]=[];
  const {course,pageId}=await fetchCourseBySlug('observation-on-the-road',warnings);
  const rows=await fetchProjectsByCourse(pageId,course.projectIds,warnings);
  const row=rows.find(r=>r.project.projectName==='Taiwan Solution');
  if(!row)throw new Error('找不到 Taiwan Solution');
  const works=await fetchStudentWorksForProject(row.project,row.fieldMapping,row.relationConfig,warnings,existingIds);
  if(warnings.some(w=>w.level==='error'))throw new Error('Notion 資料未完整讀取，請稍後再試');
  return works.filter(w=>w.mainImage).map(w=>({id:w.id,title:w.assignmentName||'Untitled',group:w.group||'',image:w.mainImage,thumbnail:w.mainImageThumbnail||w.mainImage,preview:w.mainImagePreview||w.mainImage,x:50,y:50,w:3,h:3,rotation:0,alignmentStatus:'unmatched'}));
}
