// ===============================
// PrivateChat - Supabase frontend
// ===============================
// 1. Create a Supabase project.
// 2. Run supabase.sql in Supabase SQL Editor.
// 3. Enable Anonymous Sign-Ins in Authentication > Providers.
// 4. Paste your project URL + anon key below.
// Never put a Supabase service_role key in this file.

const SUPABASE_URL = "https://ozgspkmzzgxjrsnjkqnx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0o2BZjcNGUMpItZyEdqjpA_N3vkYh8m";

const configured = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  profile: null,
  rooms: [],
  currentRoom: null,
  channel: null,
  invitationsChannel: null
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!configured) $("setupNotice").classList.remove("hidden");
  bindEvents();
  if (!configured) return;

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    await loadProfile();
  }
});

function bindEvents() {
  $("usernameForm").addEventListener("submit", handleUsername);
  $("newRoomBtn").addEventListener("click", showCreateRoom);
  $("joinRoomBtn").addEventListener("click", showJoinRoom);
  $("inviteBtn").addEventListener("click", showInvite);
  $("roomInfoBtn").addEventListener("click", showRoomInfo);
  $("messageForm").addEventListener("submit", sendMessage);
  $("imageInput").addEventListener("change", sendImage);
  $("roomSearch").addEventListener("input", renderRooms);
  $("logoutBtn").addEventListener("click", signOut);
  $("settingsBtn").addEventListener("click", showSettings);
  $("mobileBackBtn").addEventListener("click", () => $("appView").classList.remove("mobile-chat"));
  $("closeModal").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", (e) => {
    if (e.target === $("modalBackdrop")) closeModal();
  });
}

async function handleUsername(e) {
  e.preventDefault();
  if (!configured) return;
  const username = $("usernameInput").value.trim().toLowerCase();
  $("authError").textContent = "";

  if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
    $("authError").textContent = "Use 3–24 letters, numbers, underscore or dot.";
    return;
  }

  try {
    setBusy(e.target, true);
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    state.user = data.user;

    const { error: profileError } = await sb.from("profiles").insert({
      id: state.user.id,
      username
    });
    if (profileError) {
      if (profileError.code === "23505") {
        await sb.auth.signOut();
        $("authError").textContent = "That username is already taken. Pick another one.";
      } else {
        throw profileError;
      }
      return;
    }

    await loadProfile();
  } catch (err) {
    $("authError").textContent = friendlyError(err);
  } finally {
    setBusy(e.target, false);
  }
}

async function loadProfile() {
  const { data, error } = await sb.from("profiles").select("*").eq("id", state.user.id).single();
  if (error) {
    $("authError").textContent = friendlyError(error);
    return;
  }
  state.profile = data;
  $("myUsername").textContent = "@" + data.username;
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  subscribeToInvites();
  await loadRooms();
}

async function loadRooms() {
  const { data, error } = await sb
    .from("room_members")
    .select("room_id, rooms(id, name, code, created_at)")
    .eq("user_id", state.user.id)
    .order("joined_at", { ascending: false });

  if (error) return toast(friendlyError(error), true);

  state.rooms = (data || []).map(x => x.rooms).filter(Boolean);
  renderRooms();
}

function renderRooms() {
  const q = $("roomSearch").value.toLowerCase();
  const list = $("roomList");
  list.innerHTML = "";
  const rooms = state.rooms.filter(r => r.name.toLowerCase().includes(q));

  if (!rooms.length) {
    list.innerHTML = `<div style="padding:18px;color:var(--muted);font-size:13px">No rooms yet.</div>`;
    return;
  }

  const tpl = $("roomTemplate");
  rooms.forEach(room => {
    const node = tpl.content.cloneNode(true);
    const row = node.querySelector(".room-row");
    row.classList.toggle("active", state.currentRoom?.id === room.id);
    node.querySelector(".room-row-name").textContent = room.name;
    node.querySelector(".room-row-preview").textContent = "Private room";
    row.addEventListener("click", () => openRoom(room));
    list.appendChild(node);
  });
}

async function openRoom(room) {
  state.currentRoom = room;
  renderRooms();
  $("appView").classList.add("mobile-chat");
  $("emptyChat").classList.add("hidden");
  $("messageArea").classList.remove("hidden");
  $("messageForm").classList.remove("hidden");
  $("inviteBtn").disabled = false;
  $("roomInfoBtn").disabled = false;
  $("roomTitle").textContent = room.name;
  $("roomMeta").textContent = "Room " + room.code;
  $("roomAvatar").textContent = "#";
  await loadMessages();
  subscribeToMessages();
}

async function loadMessages() {
  const area = $("messageArea");
  area.innerHTML = `<div class="muted" style="text-align:center">Loading messages…</div>`;

  const { data, error } = await sb
    .from("messages")
    .select("id, room_id, sender_id, body, image_url, created_at, profiles(username)")
    .eq("room_id", state.currentRoom.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    area.innerHTML = `<div class="error" style="text-align:center">${escapeHtml(friendlyError(error))}</div>`;
    return;
  }

  area.innerHTML = "";
  (data || []).forEach(renderMessage);
  scrollMessages();
}

function subscribeToMessages() {
  if (state.channel) sb.removeChannel(state.channel);
  state.channel = sb
    .channel("room-" + state.currentRoom.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: "room_id=eq." + state.currentRoom.id
    }, async (payload) => {
      const { data } = await sb.from("profiles").select("username").eq("id", payload.new.sender_id).single();
      renderMessage({...payload.new, profiles: data});
      scrollMessages();
    })
    .subscribe();
}

function renderMessage(m) {
  const mine = m.sender_id === state.user.id;
  const wrap = document.createElement("div");
  wrap.className = "message" + (mine ? " mine" : "");

  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = mine ? "You" : "@" + (m.profiles?.username || "user");

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (m.body) {
    const text = document.createElement("div");
    text.textContent = m.body;
    bubble.appendChild(text);
  }
  if (m.image_url) {
    const img = document.createElement("img");
    img.src = m.image_url;
    img.alt = "Shared image";
    img.loading = "lazy";
    img.addEventListener("click", () => window.open(m.image_url, "_blank", "noopener"));
    bubble.appendChild(img);
  }

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = formatTime(m.created_at);
  bubble.appendChild(time);

  wrap.append(sender, bubble);
  $("messageArea").appendChild(wrap);
}

async function sendMessage(e) {
  e.preventDefault();
  if (!state.currentRoom) return;
  const input = $("messageInput");
  const body = input.value.trim();
  if (!body) return;

  input.value = "";
  const { error } = await sb.from("messages").insert({
    room_id: state.currentRoom.id,
    sender_id: state.user.id,
    body
  });
  if (error) {
    input.value = body;
    toast(friendlyError(error), true);
  }
}

async function sendImage(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !state.currentRoom) return;
  if (file.size > 8 * 1024 * 1024) {
    toast("Images must be 8 MB or smaller.", true);
    return;
  }

  try {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await sb.storage.from("chat-images").upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = sb.storage.from("chat-images").getPublicUrl(path);
    const { error } = await sb.from("messages").insert({
      room_id: state.currentRoom.id,
      sender_id: state.user.id,
      image_url: publicData.publicUrl
    });
    if (error) throw error;
  } catch (err) {
    toast(friendlyError(err), true);
  }
}

function showCreateRoom() {
  openModal(`
    <h3>Create a private room</h3>
    <p>Give the room a name. A unique room code will be generated automatically.</p>
    <form id="createRoomForm">
      <label>Room name</label>
      <input id="newRoomName" maxlength="40" placeholder="e.g. Friends" required>
      <button class="primary" type="submit">Create room</button>
    </form>
  `);
  $("createRoomForm").addEventListener("submit", createRoom);
}

async function createRoom(e) {
  e.preventDefault();
  const name = $("newRoomName").value.trim();
  if (!name) return;

  const { data, error } = await sb.rpc("create_room", { room_name: name });
  if (error) return toast(friendlyError(error), true);
  closeModal();
  await loadRooms();
  const room = state.rooms.find(r => r.id === data);
  if (room) openRoom(room);
}

function showJoinRoom() {
  openModal(`
    <h3>Join a room</h3>
    <p>Ask your friend for their 8-character room code.</p>
    <form id="joinRoomForm">
      <label>Room code</label>
      <input id="roomCodeInput" maxlength="8" style="text-transform:uppercase;letter-spacing:.15em" placeholder="AB12CD34" required>
      <button class="primary" type="submit">Join room</button>
    </form>
  `);
  $("joinRoomForm").addEventListener("submit", joinRoom);
}

async function joinRoom(e) {
  e.preventDefault();
  const code = $("roomCodeInput").value.trim().toUpperCase();
  const { data, error } = await sb.rpc("join_room_by_code", { room_code_input: code });
  if (error) return toast(friendlyError(error), true);
  closeModal();
  await loadRooms();
  const room = state.rooms.find(r => r.id === data);
  if (room) openRoom(room);
}

function showInvite() {
  if (!state.currentRoom) return;
  openModal(`
    <h3>Invite someone</h3>
    <p>Share the room code, or send a private invite to a username.</p>
    <div class="code">${escapeHtml(state.currentRoom.code)}</div>
    <button id="copyCode" class="secondary" style="width:100%">Copy room code</button>
    <form id="inviteForm">
      <label>Friend's username</label>
      <input id="inviteUsername" maxlength="24" placeholder="@username" required>
      <button class="primary" type="submit">Send private invite</button>
    </form>
    <p id="inviteResult"></p>
  `);
  $("copyCode").addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.currentRoom.code);
    $("copyCode").textContent = "Copied!";
  });
  $("inviteForm").addEventListener("submit", sendInvite);
}

async function sendInvite(e) {
  e.preventDefault();
  const username = $("inviteUsername").value.trim().replace(/^@/, "").toLowerCase();
  const { data: target, error: findError } = await sb.from("profiles").select("id, username").eq("username", username).maybeSingle();
  if (findError) return toast(friendlyError(findError), true);
  if (!target) {
    $("inviteResult").textContent = "No user with that username exists yet.";
    return;
  }
  if (target.id === state.user.id) {
    $("inviteResult").textContent = "That's your own username.";
    return;
  }

  const { error } = await sb.from("room_invites").upsert({
    room_id: state.currentRoom.id,
    inviter_id: state.user.id,
    invitee_id: target.id
  }, { onConflict: "room_id,invitee_id" });

  $("inviteResult").textContent = error ? friendlyError(error) : "Invite sent to @" + target.username + ".";
}

function subscribeToInvites() {
  if (state.invitationsChannel) sb.removeChannel(state.invitationsChannel);
  state.invitationsChannel = sb
    .channel("invites-" + state.user.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "room_invites",
      filter: "invitee_id=eq." + state.user.id
    }, async (payload) => {
      const { data: room } = await sb.from("rooms").select("*").eq("id", payload.new.room_id).single();
      const { data: inviter } = await sb.from("profiles").select("username").eq("id", payload.new.inviter_id).single();
      if (room) showIncomingInvite(room, inviter?.username || "someone");
    })
    .subscribe();
}

function showIncomingInvite(room, inviter) {
  openModal(`
    <h3>New room invite</h3>
    <p><strong>@${escapeHtml(inviter)}</strong> invited you to <strong>${escapeHtml(room.name)}</strong>.</p>
    <p>Room code: <strong>${escapeHtml(room.code)}</strong></p>
    <div style="display:flex;gap:8px">
      <button id="acceptInvite" class="primary" style="flex:1">Join room</button>
      <button id="declineInvite" class="secondary">Close</button>
    </div>
  `);
  $("acceptInvite").addEventListener("click", async () => {
    const { error } = await sb.rpc("join_room_by_code", { room_code_input: room.code });
    if (error) return toast(friendlyError(error), true);
    await sb.from("room_invites").delete().eq("id", room.id).eq("invitee_id", state.user.id);
    closeModal();
    await loadRooms();
    const joined = state.rooms.find(r => r.id === room.id);
    if (joined) openRoom(joined);
  });
  $("declineInvite").addEventListener("click", closeModal);
}

async function showRoomInfo() {
  if (!state.currentRoom) return;
  const { data, error } = await sb
    .from("room_members")
    .select("user_id, profiles(username)")
    .eq("room_id", state.currentRoom.id);
  if (error) return toast(friendlyError(error), true);

  const members = (data || []).map(m => `<div class="member"><span>@${escapeHtml(m.profiles?.username || "user")}</span>${m.user_id === state.user.id ? "<small>You</small>" : ""}</div>`).join("");
  openModal(`
    <h3>${escapeHtml(state.currentRoom.name)}</h3>
    <p>Share this code with anyone you want to let into the room.</p>
    <div class="code">${escapeHtml(state.currentRoom.code)}</div>
    <h4>Members</h4>
    <div class="member-list">${members || "<p>No members.</p>"}</div>
  `);
}

function showSettings() {
  openModal(`
    <h3>Your account</h3>
    <p>Your username is <strong>@${escapeHtml(state.profile.username)}</strong>.</p>
    <p>This starter keeps usernames permanent for the anonymous account. If you need username changes later, add an account system (email/password or OAuth) rather than relying on browser storage.</p>
  `);
}

async function signOut() {
  await sb.auth.signOut();
  location.reload();
}

function openModal(html) {
  $("modalContent").innerHTML = html;
  $("modalBackdrop").classList.remove("hidden");
}
function closeModal() {
  $("modalBackdrop").classList.add("hidden");
  $("modalContent").innerHTML = "";
}
function scrollMessages() {
  const area = $("messageArea");
  area.scrollTop = area.scrollHeight;
}
function formatTime(iso) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function setBusy(form, busy) {
  const button = form.querySelector("button[type=submit]");
  if (button) button.disabled = busy;
}
function friendlyError(err) {
  return err?.message || "Something went wrong.";
}
function toast(message, error = false) {
  // Lightweight notification without a dependency.
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = `position:fixed;right:18px;bottom:18px;z-index:99;padding:12px 15px;border-radius:10px;background:${error ? "#7f1d1d" : "#1e293b"};color:white;box-shadow:0 12px 30px rgba(0,0,0,.3);max-width:360px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}
