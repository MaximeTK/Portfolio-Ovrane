import { redirect } from 'next/navigation';
import { PAGE_DEPART } from '@/features/illusion/pages/liste';

export default function Illusion() {
  redirect(`/illusion/${PAGE_DEPART}`);
}
