import PatientForm from '@/components/patients/PatientForm';

export default function EditPatientPage({
  params
}: {
  params: { id: string };
}) {
  return <PatientForm patientId={params.id} />;
}
