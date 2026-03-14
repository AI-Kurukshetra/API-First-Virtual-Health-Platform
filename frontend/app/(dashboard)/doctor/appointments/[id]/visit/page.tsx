import VisitWorkspace from '@/components/video-visits/VisitWorkspace';

export default function DoctorVisitPage({
  params
}: {
  params: { id: string };
}) {
  return <VisitWorkspace appointmentId={params.id} role="doctor" />;
}
