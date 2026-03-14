'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BrainCircuit,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  UserRound,
  Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AiNotePayload, VideoVisit, VideoVisitSignal } from '@/types';

interface VisitResponse {
  data: VideoVisit;
}

interface SignalsResponse {
  data: VideoVisitSignal[];
}

type Role = 'doctor' | 'patient';

function formatDateTime(value?: string | null) {
  if (!value) return 'Schedule pending';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Schedule pending';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function VisitWorkspace({
  appointmentId,
  role
}: {
  appointmentId: string;
  role: Role;
}) {
  const router = useRouter();
  const otherRole = role === 'doctor' ? 'patient' : 'doctor';
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);
  const lastSignalAtRef = React.useRef<string | null>(null);
  const processedSignalIdsRef = React.useRef<Set<string>>(new Set());
  const hasSentOfferRef = React.useRef(false);

  const [visit, setVisit] = React.useState<VideoVisit | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState(false);
  const [joining, setJoining] = React.useState(false);
  const [remoteConnected, setRemoteConnected] = React.useState(false);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [callLabel, setCallLabel] = React.useState('Ready to join');
  const [generatingAi, setGeneratingAi] = React.useState(false);
  const [draftMessage, setDraftMessage] = React.useState<string | null>(null);

  const canJoin = visit?.status !== 'ended';
  const hasAiDraft = Boolean(visit?.ai_note_payload);

  const cleanupPeer = React.useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteConnected(false);
    hasSentOfferRef.current = false;
    lastSignalAtRef.current = null;
    processedSignalIdsRef.current.clear();
  }, []);

  const loadVisit = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<VisitResponse>(`/video-visits/appointment/${appointmentId}`);
      setVisit(response.data);
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to load video visit');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  React.useEffect(() => {
    loadVisit();
  }, [loadVisit]);

  const sendSignal = React.useCallback(
    async (kind: VideoVisitSignal['kind'], payload: Record<string, any>) => {
      if (!visit) return;
      await api.post(`/video-visits/${visit.id}/signals`, {
        recipient_role: otherRole,
        kind,
        payload
      });
    },
    [otherRole, visit]
  );

  const createPeerConnection = React.useCallback(
    async (stream: MediaStream) => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
        ]
      });

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        const [incomingStream] = event.streams;
        if (!incomingStream) return;
        remoteStreamRef.current = incomingStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = incomingStream;
        }
        setRemoteConnected(true);
        setCallLabel('Both participants connected');
      };

      peer.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          await sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
        } catch {
          // best-effort signaling update
        }
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (state === 'connected') {
          setRemoteConnected(true);
          setCallLabel('Live consultation in progress');
        } else if (state === 'disconnected' || state === 'failed') {
          setRemoteConnected(false);
          setCallLabel('Connection dropped. Waiting to reconnect.');
        }
      };

      peerConnectionRef.current = peer;
      return peer;
    },
    [sendSignal]
  );

  const createOffer = React.useCallback(async () => {
    if (!peerConnectionRef.current || hasSentOfferRef.current) return;
    if (peerConnectionRef.current.signalingState !== 'stable') return;

    hasSentOfferRef.current = true;
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    await sendSignal('offer', { sdp: offer });
    setCallLabel('Waiting for patient to join the room');
  }, [sendSignal]);

  const handleSignal = React.useCallback(
    async (signal: VideoVisitSignal) => {
      if (!peerConnectionRef.current || !joined) return;

      if (signal.kind === 'ready') {
        setRemoteConnected(true);
        if (role === 'doctor') {
          await createOffer();
        }
        return;
      }

      if (signal.kind === 'offer' && role === 'patient') {
        if (!peerConnectionRef.current.currentRemoteDescription) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(signal.payload.sdp)
          );
        }
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        await sendSignal('answer', { sdp: answer });
        setCallLabel('Connecting to doctor');
        return;
      }

      if (signal.kind === 'answer' && role === 'doctor') {
        if (!peerConnectionRef.current.currentRemoteDescription) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(signal.payload.sdp)
          );
        }
        setCallLabel('Patient joined the room');
        return;
      }

      if (signal.kind === 'ice-candidate') {
        if (signal.payload?.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(signal.payload.candidate)
            );
          } catch {
            // ignore stale candidates during reconnects
          }
        }
        return;
      }

      if (signal.kind === 'leave') {
        setRemoteConnected(false);
        setCallLabel('The other participant left the room');
      }
    },
    [createOffer, joined, role, sendSignal]
  );

  React.useEffect(() => {
    if (!visit?.id || !joined) return;

    const interval = window.setInterval(async () => {
      try {
        const since = lastSignalAtRef.current ? `?since=${encodeURIComponent(lastSignalAtRef.current)}` : '';
        const response = await api.get<SignalsResponse>(`/video-visits/${visit.id}/signals${since}`);
        const signals = response.data || [];
        for (const signal of signals) {
          if (processedSignalIdsRef.current.has(signal.id)) continue;
          processedSignalIdsRef.current.add(signal.id);
          await handleSignal(signal);
          lastSignalAtRef.current = signal.created_at;
        }
      } catch {
        // ignore polling failures; next poll can recover
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [handleSignal, joined, visit?.id]);

  React.useEffect(() => {
    if (!visit?.id) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await api.get<VisitResponse>(`/video-visits/appointment/${appointmentId}`);
        setVisit(response.data);
        if (response.data.status === 'ended' && joined) {
          cleanupPeer();
          setJoined(false);
          setCallLabel('Consultation ended by doctor');
        }
      } catch {
        // passive refresh only
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [appointmentId, cleanupPeer, joined, visit?.id]);

  React.useEffect(() => {
    return () => {
      cleanupPeer();
    };
  }, [cleanupPeer]);

  async function handleJoin() {
    if (!visit || !canJoin) return;

    setJoining(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await createPeerConnection(stream);
      const response = await api.patch<VisitResponse>(`/video-visits/${visit.id}/presence`, {
        action: 'join'
      });
      lastSignalAtRef.current = new Date().toISOString();
      processedSignalIdsRef.current.clear();
      setVisit(response.data);
      setJoined(true);
      setMicEnabled(true);
      setCameraEnabled(true);
      setCallLabel(role === 'doctor' ? 'Waiting for patient to join' : 'Waiting for doctor to connect');
      await sendSignal('ready', {});
      if (role === 'doctor' && response.data.patient_online) {
        await createOffer();
      }
    } catch (err: any) {
      cleanupPeer();
      setError(err?.error?.message ?? 'Unable to join the video consultation');
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave(endForAll = false) {
    if (!visit) return;

    try {
      if (joined) {
        await sendSignal('leave', { ended: endForAll });
      }
      const action = endForAll ? 'end' : 'leave';
      const response = await api.patch<VisitResponse>(`/video-visits/${visit.id}/presence`, {
        action
      });
      setVisit(response.data);
    } catch {
      // leave should still cleanup locally
    } finally {
      cleanupPeer();
      setJoined(false);
      setCallLabel(endForAll ? 'Consultation ended' : 'You left the room');
    }
  }

  function toggleAudio() {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  }

  function toggleVideo() {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);
  }

  async function handleGenerateAiDraft() {
    if (!visit || role !== 'doctor') return;

    setGeneratingAi(true);
    setDraftMessage(null);
    try {
      const response = await api.post<VisitResponse>(`/video-visits/${visit.id}/ai-draft`);
      setVisit(response.data);
      setDraftMessage('AI draft generated for this appointment. Review it from the patient chart.');
    } catch (err: any) {
      setError(err?.error?.message ?? 'Unable to generate AI draft');
    } finally {
      setGeneratingAi(false);
    }
  }

  function handleOpenChart() {
    if (!visit?.patient?.id || !visit?.appointment?.id) return;
    window.open(
      `/doctor/patients/${visit.patient.id}?tab=consultations&appointment=${visit.appointment.id}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  function handleReturnToWorkspace() {
    router.push(role === 'doctor' ? '/doctor/appointments' : '/patient/appointments');
  }

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-5 w-52 rounded bg-[#e8f1ed]" />
        <div className="mt-4 h-3 w-72 rounded bg-[#eef5f2]" />
      </Card>
    );
  }

  if (error && !visit) {
    return (
      <Card className="border-danger/30 bg-[#fff5f5]">
        <p className="text-sm font-semibold text-danger">{error}</p>
      </Card>
    );
  }

  if (!visit) {
    return (
      <Card>
        <p className="text-sm text-muted">Video visit not found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[#d6e4f2] bg-[linear-gradient(135deg,#ffffff_0%,#f4fbff_48%,#f9fdff_100%)] p-6 shadow-[0_24px_70px_rgba(11,31,26,0.08)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_center,rgba(30,93,176,0.14),transparent_58%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9f7] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-info shadow-sm">
              <Video className="h-3.5 w-3.5" />
              Live Consultation
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              {role === 'doctor' ? 'Doctor video studio' : 'Patient visit room'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              This room is locked to the selected appointment. Only the assigned doctor and patient can
              join, and the AI note workflow stays attached to the same consultation.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/92 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Visit time</p>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {formatDateTime(visit.appointment?.availability?.start_at)}
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#1e5db0] p-4 text-white shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Room state</p>
                <p className="mt-3 text-xl font-semibold">{visit.status}</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[#eef9f3] p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Consultation</p>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {visit.consultation?.status || 'Not created yet'}
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-[28px] border-[#dce8f6] bg-white/92 shadow-[0_14px_40px_rgba(11,31,26,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Visit guardrails</p>
            <div className="mt-5 space-y-4">
              {[
                'Only the appointment doctor and patient can access this room.',
                'Video consultation is available only for booked video appointments.',
                role === 'doctor'
                  ? 'Generate the AI draft here, then review and finalize it in the patient chart.'
                  : 'Your doctor may use AI-assisted note drafting during this call.'
              ].map((item, index) => (
                <div key={item} className="flex gap-4 rounded-2xl bg-[#f6f9ff] px-4 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e5db0] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm text-ink">{item}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {error ? (
        <Card className="border-danger/30 bg-[#fff5f5]">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}
      {draftMessage ? (
        <Card className="border-primary/20 bg-[#f4fbf7]">
          <p className="text-sm font-semibold text-primary">{draftMessage}</p>
        </Card>
      ) : null}

      <section className={`grid gap-6 ${role === 'doctor' ? 'xl:grid-cols-[1.06fr_0.94fr]' : 'xl:grid-cols-[1fr_0.82fr]'}`}>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_100%)] px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Video room</p>
                <h2 className="mt-2 text-xl font-semibold text-ink">
                  {visit.appointment?.reason || 'Scheduled consultation'}
                </h2>
                <p className="mt-2 text-sm text-muted">{callLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleReturnToWorkspace}>
                  <ArrowLeft className="h-4 w-4" />
                  Appointments
                </Button>
                {!joined ? (
                  <Button type="button" isLoading={joining} disabled={!canJoin} onClick={handleJoin}>
                    <Phone className="h-4 w-4" />
                    {visit.status === 'ended' ? 'Visit ended' : 'Join room'}
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={toggleAudio}>
                      {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      {micEnabled ? 'Mute' : 'Unmute'}
                    </Button>
                    <Button type="button" variant="outline" onClick={toggleVideo}>
                      {cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                      {cameraEnabled ? 'Camera off' : 'Camera on'}
                    </Button>
                    {role === 'doctor' ? (
                      <Button type="button" variant="ghost" onClick={() => handleLeave(true)}>
                        <PhoneOff className="h-4 w-4" />
                        End visit
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" onClick={() => handleLeave(false)}>
                        <PhoneOff className="h-4 w-4" />
                        Leave room
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">You</p>
                <span className="rounded-full bg-[#eef9f3] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {joined ? 'Connected' : 'Pre-join'}
                </span>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-[#dce7f4] bg-[#eef4fb]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full bg-[#dbe6f4] object-cover"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  {role === 'doctor' ? 'Patient' : 'Doctor'}
                </p>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    remoteConnected ? 'bg-[#e6f7f0] text-primary' : 'bg-[#eef3f0] text-muted'
                  }`}
                >
                  {remoteConnected ? 'Connected' : 'Waiting'}
                </span>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-[#dce7f4] bg-[#eef4fb]">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="aspect-video w-full bg-[#dbe6f4] object-cover"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border px-6 py-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Doctor</p>
                <p className="mt-2 text-sm font-semibold text-ink">{visit.doctor?.full_name}</p>
              </div>
              <div className="rounded-3xl bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Patient</p>
                <p className="mt-2 text-sm font-semibold text-ink">{visit.patient?.full_name}</p>
              </div>
              <div className="rounded-3xl bg-[#f8fbff] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Meeting mode</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {visit.appointment?.availability?.mode === 'video' ? 'Video consultation' : 'Clinic visit'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {role === 'doctor' ? (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    AI Consultation Notes
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Generate AI draft for this visit</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[#eef9f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Doctor review required
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-[28px] border border-[#dce7f4] bg-[#fbfdff] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">AI action</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Generate the consultation draft from the appointment context and the current visit record.
                  Final review, editing, and prescription work stay in the patient chart.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button type="button" isLoading={generatingAi} onClick={handleGenerateAiDraft}>
                    <BrainCircuit className="h-4 w-4" />
                    Generate AI text
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#dce7f4] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Draft status</p>
                <p className="mt-2 text-sm text-muted">
                  {hasAiDraft
                    ? 'AI draft is ready for review in the patient chart consultation tab.'
                    : 'No AI draft generated yet for this appointment.'}
                </p>
              </div>

              <div className="rounded-[28px] border border-[#dce7f4] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Consultation sync</p>
                <p className="mt-2 text-sm text-muted">
                  {visit.consultation
                    ? `Consultation ${visit.consultation.status} is linked to this appointment. Pull the latest AI draft into the chart before saving or finalizing.`
                    : 'No consultation note exists yet. Open the patient chart and pull this visit draft to start the note safely.'}
                </p>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!visit.patient?.id || !visit.appointment?.id}
                    onClick={handleOpenChart}
                  >
                    <Sparkles className="h-4 w-4" />
                    Open patient chart
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Visit context</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Consultation details</h2>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="rounded-[28px] border border-[#dce7f4] bg-[#fbfdff] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e6f0ff_0%,#dceaff_100%)] text-info">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Doctor</p>
                    <p className="mt-1 text-base font-semibold text-ink">{visit.doctor?.full_name}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#dce7f4] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Visit reason</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">
                  {visit.appointment?.reason || 'No appointment note shared.'}
                </p>
              </div>

              <div className="rounded-[28px] border border-[#dce7f4] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">AI note workflow</p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Your doctor may use AI-assisted drafting during this consultation, but the final summary is only
                  published after doctor review in the consultation module.
                </p>
              </div>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
