import PatientDetail from '@/components/patients/PatientDetail';

export default function PatientDetailPage({
  params
}: {
  params: { id: string };
}) {
  return <PatientDetail patientId={params.id} />;
}
