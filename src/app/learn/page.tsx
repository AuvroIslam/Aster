import type { Metadata } from 'next';
import { Workspace } from '@/components/learn/workspace';

export const metadata: Metadata = {
  title: 'Lesson — Aster',
  description: 'Watch, ask, and practise a lesson with Aster.',
};

export default function LearnPage() {
  return <Workspace />;
}
