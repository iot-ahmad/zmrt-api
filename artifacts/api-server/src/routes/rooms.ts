import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CallZamratBody,
  CallZamratParams,
  CallZamratResponse,
  CreateRoomBody,
  CreateRoomResponse,
  GetRoomHeader,
  GetRoomParams,
  GetRoomResponse,
  JoinRoomBody,
  JoinRoomParams,
  JoinRoomResponse,
  PassCardBody,
  PassCardParams,
  PassCardResponse,
  RoomView,
  StartRoomBody,
  StartRoomParams,
  StartRoomResponse,
} from "@workspace/api-zod";

type GameStatus = "waiting" | "playing" | "finished";

type Player = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  hand: string[];
  isHost: boolean;
  isReady: boolean;
};

type Room = {
  code: string;
  maxPlayers: number;
  status: GameStatus;
  round: number;
  activePlayerId: string | null;
  winnerId: string | null;
  players: Player[];
  pendingCards: Map<string, string>;
  feed: string[];
};

const router: IRouter = Router();
const rooms = new Map<string, Room>();

const avatars = ["sun", "wave", "berry", "lime", "peach", "leaf", "bloom", "spark", "mint", "coral"];
const fruits = [
  "strawberry",
  "banana",
  "grape",
  "apple",
  "watermelon",
  "orange",
  "pineapple",
  "kiwi",
  "peach",
  "blueberry",
];
const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function roomCode(): string {
  let code = "";
  do {
    code = Array.from({ length: 5 }, () =>
      roomAlphabet[Math.floor(Math.random() * roomAlphabet.length)],
    ).join("");
  } while (rooms.has(code));
  return code;
}

function cleanName(name: string): string {
  return name.trim().slice(0, 18);
}

function getRoomOrNull(value: string | string[]): Room | null {
  const code = Array.isArray(value) ? value[0] : value;
  return rooms.get(code.toUpperCase()) ?? null;
}

function addFeed(room: Room, message: string): void {
  room.feed = [...room.feed, message].slice(-8);
}

function errorMessage(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function deal(room: Room): void {
  const count = room.players.length;
  const deck = Array.from({ length: count }, (_, fruitIndex) =>
    Array.from({ length: count }, () => fruits[fruitIndex]),
  ).flat();

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  room.players.forEach((player) => {
    player.hand = [];
    player.isReady = false;
  });
  for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
    room.players.forEach((player) => {
      const card = deck.shift();
      if (card) player.hand.push(card);
    });
  }
  room.pendingCards.clear();
}

function complete(player: Player): boolean {
  return player.hand.length > 0 && player.hand.every((card) => card === player.hand[0]);
}

function finish(room: Room, winner: Player): void {
  room.status = "finished";
  room.winnerId = winner.id;
  room.activePlayerId = null;

  const winnerIndex = room.players.findIndex((player) => player.id === winner.id);
  room.players.forEach((player, index) => {
    const offset = (index - winnerIndex + room.players.length) % room.players.length;
    player.score += Math.max(10, 100 - offset * 10);
    player.isReady = false;
  });
  addFeed(room, `${winner.name} قال زمرت!`);
}

function viewFor(room: Room, playerId: string): RoomView {
  const viewer = room.players.find((player) => player.id === playerId);
  if (!viewer) throw new Error("Player is not in this room");

  return {
    roomCode: room.code,
    viewerPlayerId: viewer.id,
    status: room.status,
    maxPlayers: room.maxPlayers,
    round: room.round,
    activePlayerId: room.activePlayerId,
    winnerId: room.winnerId,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      cardCount: player.hand.length,
      isHost: player.isHost,
      isReady: player.isReady,
    })),
    hand: viewer.hand,
    feed: room.feed,
    canStart:
      room.status === "waiting" &&
      viewer.isHost &&
      room.players.length >= 3,
    canPass: room.status === "playing" && !viewer.isReady,
    canCallZamrat: room.status === "playing" && complete(viewer),
  };
}

function findPlayer(room: Room, playerId: string): Player | undefined {
  return room.players.find((player) => player.id === playerId);
}

router.post("/rooms", (req, res): void => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    errorMessage(res, 400, parsed.error.message);
    return;
  }

  const name = cleanName(parsed.data.playerName);
  if (!name) {
    errorMessage(res, 400, "اكتب اسمًا صالحًا للانضمام.");
    return;
  }

  const code = roomCode();
  const playerId = randomUUID();
  const room: Room = {
    code,
    maxPlayers: parsed.data.maxPlayers ?? 8,
    status: "waiting",
    round: 0,
    activePlayerId: null,
    winnerId: null,
    players: [
      {
        id: playerId,
        name,
        avatar: avatars[0],
        score: 0,
        hand: [],
        isHost: true,
        isReady: false,
      },
    ],
    pendingCards: new Map(),
    feed: [`${name} أنشأ الغرفة.`],
  };
  rooms.set(code, room);

  res.status(201).json(CreateRoomResponse.parse(viewFor(room, playerId)));
});

router.get("/rooms/:roomCode", (req, res): void => {
  const params = GetRoomParams.safeParse(req.params);
  const header = GetRoomHeader.safeParse({
    "X-Player-Id": req.headers["x-player-id"],
  });
  if (!params.success || !header.success) {
    errorMessage(res, 400, "بيانات الغرفة غير صالحة.");
    return;
  }

  const room = getRoomOrNull(params.data.roomCode);
  if (!room) {
    errorMessage(res, 404, "الغرفة غير موجودة أو انتهت.");
    return;
  }
  const playerId = header.data["X-Player-Id"];
  if (!findPlayer(room, playerId)) {
    errorMessage(res, 404, "اللاعب غير موجود في هذه الغرفة.");
    return;
  }

  res.json(GetRoomResponse.parse(viewFor(room, playerId)));
});

router.post("/rooms/:roomCode", (req, res): void => {
  const params = JoinRoomParams.safeParse(req.params);
  const body = JoinRoomBody.safeParse(req.body);
  if (!params.success || !body.success) {
    errorMessage(res, 400, "اكتب اسمًا صالحًا للانضمام.");
    return;
  }

  const room = getRoomOrNull(params.data.roomCode);
  if (!room) {
    errorMessage(res, 404, "الغرفة غير موجودة أو انتهت.");
    return;
  }
  if (room.status !== "waiting") {
    errorMessage(res, 400, "بدأت هذه الجولة بالفعل.");
    return;
  }
  if (room.players.length >= room.maxPlayers) {
    errorMessage(res, 400, "الغرفة ممتلئة.");
    return;
  }

  const name = cleanName(body.data.playerName);
  if (!name) {
    errorMessage(res, 400, "اكتب اسمًا صالحًا للانضمام.");
    return;
  }

  const playerId = randomUUID();
  room.players.push({
    id: playerId,
    name,
    avatar: avatars[room.players.length % avatars.length],
    score: 0,
    hand: [],
    isHost: false,
    isReady: false,
  });
  addFeed(room, `${name} انضم إلى الغرفة.`);

  res.json(JoinRoomResponse.parse(viewFor(room, playerId)));
});

router.post("/rooms/:roomCode/start", (req, res): void => {
  const params = StartRoomParams.safeParse(req.params);
  const body = StartRoomBody.safeParse(req.body);
  if (!params.success || !body.success) {
    errorMessage(res, 400, "لا يمكن بدء الغرفة بهذه البيانات.");
    return;
  }

  const room = getRoomOrNull(params.data.roomCode);
  if (!room) {
    errorMessage(res, 404, "الغرفة غير موجودة أو انتهت.");
    return;
  }
  const player = findPlayer(room, body.data.playerId);
  if (!player?.isHost) {
    errorMessage(res, 400, "فقط منشئ الغرفة يستطيع بدء الجولة.");
    return;
  }
  if (room.players.length < 3) {
    errorMessage(res, 400, "تحتاج الغرفة إلى 3 لاعبين على الأقل.");
    return;
  }

  room.status = "playing";
  room.round = 1;
  room.winnerId = null;
  deal(room);
  addFeed(room, "بدأت الجولة. اختاروا ورقة ومرروها.");

  res.json(StartRoomResponse.parse(viewFor(room, body.data.playerId)));
});

router.post("/rooms/:roomCode/pass", (req, res): void => {
  const params = PassCardParams.safeParse(req.params);
  const body = PassCardBody.safeParse(req.body);
  if (!params.success || !body.success) {
    errorMessage(res, 400, "اختيار الورقة غير صالح.");
    return;
  }

  const room = getRoomOrNull(params.data.roomCode);
  if (!room) {
    errorMessage(res, 404, "الغرفة غير موجودة أو انتهت.");
    return;
  }
  const player = findPlayer(room, body.data.playerId);
  if (!player) {
    errorMessage(res, 400, "اللاعب غير موجود في هذه الغرفة.");
    return;
  }
  if (room.status !== "playing" || player.isReady) {
    errorMessage(res, 400, "لقد مررت ورقتك بالفعل أو انتهت الجولة.");
    return;
  }
  if (body.data.cardIndex >= player.hand.length) {
    errorMessage(res, 400, "اختر ورقة موجودة في يدك.");
    return;
  }

  const [card] = player.hand.splice(body.data.cardIndex, 1);
  room.pendingCards.set(player.id, card);
  player.isReady = true;
  addFeed(room, `${player.name} مرر ورقة.`);

  if (room.players.every((currentPlayer) => currentPlayer.isReady)) {
    room.players.forEach((currentPlayer, index) => {
      const previousPlayer = room.players[(index - 1 + room.players.length) % room.players.length];
      const incoming = room.pendingCards.get(previousPlayer.id);
      if (incoming) currentPlayer.hand.push(incoming);
      currentPlayer.isReady = false;
    });
    room.pendingCards.clear();
    room.round += 1;

    const winner = room.players.find(complete);
    if (winner) {
      finish(room, winner);
    } else {
      addFeed(room, `انتهت الجولة ${room.round - 1}. مرروا من جديد.`);
    }
  }

  res.json(PassCardResponse.parse(viewFor(room, body.data.playerId)));
});

router.post("/rooms/:roomCode/zamrat", (req, res): void => {
  const params = CallZamratParams.safeParse(req.params);
  const body = CallZamratBody.safeParse(req.body);
  if (!params.success || !body.success) {
    errorMessage(res, 400, "تعذر تسجيل النداء.");
    return;
  }

  const room = getRoomOrNull(params.data.roomCode);
  if (!room) {
    errorMessage(res, 404, "الغرفة غير موجودة أو انتهت.");
    return;
  }
  const player = findPlayer(room, body.data.playerId);
  if (!player) {
    errorMessage(res, 400, "اللاعب غير موجود في هذه الغرفة.");
    return;
  }
  if (room.status !== "playing") {
    errorMessage(res, 400, "لا توجد جولة نشطة.");
    return;
  }
  if (!complete(player)) {
    addFeed(room, `${player.name} نادى زمرت قبل اكتمال مجموعته.`);
    res.json(CallZamratResponse.parse(viewFor(room, player.id)));
    return;
  }

  finish(room, player);
  res.json(CallZamratResponse.parse(viewFor(room, player.id)));
});

export default router;