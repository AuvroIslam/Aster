import type { Metadata } from 'next';
import { StudySurface } from '@/components/study/surface';

export const metadata: Metadata = {
  title: 'Notes and PDFs — Aster',
  description: 'Upload notes, textbooks or slides and have Aster explain their visual content.',
};

export default function StudyPage() {
  return <StudySurface />;
}
