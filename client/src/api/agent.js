import client from './client'

export const getPersonas = () =>
  client.get('/agent/personas').then(r => r.data.data)

export const sendCoachMessage = ({ personaId, customPersona, goal, messages }) =>
  client.post('/agent/chat', { personaId, customPersona, goal, messages }).then(r => r.data.data)

export const sendRoundtableMessage = ({ personaIds, topic, history }) =>
  client.post('/agent/roundtable', { personaIds, topic, history }).then(r => r.data.data)
