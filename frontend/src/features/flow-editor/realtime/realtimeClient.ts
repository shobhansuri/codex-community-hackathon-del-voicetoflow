const OPENAI_REALTIME_CALLS_URL =
  import.meta.env.VITE_OPENAI_REALTIME_CALLS_URL ??
  'https://api.openai.com/v1/realtime/calls'

export type RealtimeServerEvent = {
  type?: string
  [key: string]: unknown
}

type RealtimeClientOptions = {
  clientSecret: string
  onClose: () => void
  onError: (message: string) => void
  onEvent: (event: RealtimeServerEvent) => void
  onOpen: (send: (event: unknown) => void) => void
}

export type RealtimeConnection = {
  close: () => void
  send: (event: unknown) => void
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Realtime connection failed.'
}

export async function createRealtimeConnection({
  clientSecret,
  onClose,
  onError,
  onEvent,
  onOpen,
}: RealtimeClientOptions): Promise<RealtimeConnection> {
  const peerConnection = new RTCPeerConnection()
  const audioElement = document.createElement('audio')
  const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const dataChannel = peerConnection.createDataChannel('oai-events')
  let closed = false

  function send(event: unknown) {
    if (dataChannel.readyState !== 'open') {
      return
    }

    dataChannel.send(JSON.stringify(event))
  }

  function close() {
    if (closed) {
      return
    }

    closed = true
    mediaStream.getTracks().forEach((track) => track.stop())
    dataChannel.close()
    peerConnection.close()
    audioElement.pause()
    audioElement.srcObject = null
    onClose()
  }

  try {
    audioElement.autoplay = true
    peerConnection.ontrack = (event) => {
      audioElement.srcObject = event.streams[0] ?? null
    }
    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'disconnected'
      ) {
        onError('Realtime voice connection was interrupted.')
      }
    }
    dataChannel.addEventListener('open', () => onOpen(send))
    dataChannel.addEventListener('close', close)
    dataChannel.addEventListener('message', (event) => {
      try {
        onEvent(JSON.parse(event.data) as RealtimeServerEvent)
      } catch {
        onError('Realtime returned an unreadable event.')
      }
    })

    mediaStream.getAudioTracks().forEach((track) => {
      peerConnection.addTrack(track, mediaStream)
    })

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: 'POST',
      body: offer.sdp ?? '',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
    })

    if (!response.ok) {
      throw new Error(`Realtime call failed with ${response.status}.`)
    }

    await peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: await response.text(),
    })

    return {
      close,
      send,
    }
  } catch (error) {
    close()
    throw new Error(getErrorMessage(error))
  }
}
