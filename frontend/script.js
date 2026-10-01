const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const send = document.getElementById('send');

send.onclick = ask;
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ask();
});

async function ask() {
  const t = input.value.trim();
  if (!t) return;

  add('YOU: ' + t, 'user');
  input.value = '';
  const processing = add('J.A.R.V.I.S: Processing...', 'ai');
  send.disabled = true;

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt: t})
    });

    const data = await res.json();

    if (!res.ok || !data.text) {
      throw new Error(data.error || 'Backend request failed');
    }

    processing.innerText = 'J.A.R.V.I.S: ' + data.text;
  } catch (err) {
    processing.innerText = 'J.A.R.V.I.S: CONNECTION ERROR — ' + err.message;
  } finally {
    send.disabled = false;
  }
}

function add(text, who) {
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.innerText = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  return d;
}
