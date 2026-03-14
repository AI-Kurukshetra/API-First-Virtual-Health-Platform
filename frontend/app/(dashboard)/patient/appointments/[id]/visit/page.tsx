import VisitWorkspace from '@/components/video-visits/VisitWorkspace';

export default function PatientVisitPage({
  params
}: {
  params: { id: string };
}) {
  return <VisitWorkspace appointmentId={params.id} role="patient" />;
}
