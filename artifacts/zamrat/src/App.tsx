import { useEffect, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetRoomQueryKey,
  useCallZamrat,
  useCreateRoom,
  useGetRoom,
  useJoinRoom,
  usePassCard,
  useStartRoom,
  type RoomView,
  type PlayerView,
} from '@workspace/api-client-react';
import { ArrowRight, Check, Clipboard, Crown, Loader2, Play, RefreshCw, Send, Sparkles, Users, X } from 'lucide-react';
import { Route, Switch, Link, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const PLAYER_KEY = 'zamrat-player';

function playerStorageKey(roomCode: string) {
  return `${PLAYER_KEY}:${roomCode.toUpperCase()}`;
}

function friendlyError(error: unknown) {
  if (typeof error === 'object' && error && 'error' in error) return String((error as { error: string }).error);
  if (error instanceof Error) return error.message;
  return 'حدث خطأ ما. حاول مجدداً.';
}

function AppMeta() {
  useEffect(() => {
    document.title = 'زمرت — مرّر الفاكهة، اعرف المطابقة';
    const description = document.querySelector('meta[name="description"]') ?? document.createElement('meta');
    description.setAttribute('name', 'description');
    description.setAttribute('content', 'زمرت — لعبة غرف الفواكه الجماعية أونلاين. أنشئ غرفة، شارك الكود، والعب مع أصدقائك.');
    document.head.appendChild(description);
    const theme = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
    theme.setAttribute('name', 'theme-color');
    theme.setAttribute('content', '#f7f2e8');
    document.head.appendChild(theme);
  }, []);
  return null;
}

function Logo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2" data-testid="link-home-logo">
      <span className="grid h-9 w-9 rotate-[-8deg] place-items-center rounded-[11px] bg-[#d94e72] text-sm font-extrabold text-[#fffaf0] shadow-[3px_3px_0_#2c2941] transition-transform group-hover:rotate-3">ز</span>
      <span className="display-font text-xl font-extrabold tracking-[-0.06em]">زمرت</span>
    </Link>
  );
}

function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'lime' }) {
  const variants = {
    primary: 'bg-[#d94e72] text-[#fffaf0] shadow-[0_5px_0_#a83255] hover:bg-[#c94266]',
    secondary: 'bg-[#fffaf0] text-[#2c2941] border-[#dfd5c4] shadow-[0_4px_0_#dfd5c4] hover:bg-[#f4ecdf]',
    ghost: 'bg-transparent text-[#665f6e] hover:bg-[#eee6d9] hover:text-[#2c2941]',
    lime: 'bg-[#bad943] text-[#2c2941] shadow-[0_5px_0_#829a22] hover:bg-[#c6e454]',
  };
  return (
    <button
      className={`tactile inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
  testId,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  autoFocus?: boolean;
  testId: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.12em] text-[#716977]">{label}</span>
      <input
        autoFocus={autoFocus}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="h-12 w-full rounded-xl border border-[#dfd5c4] bg-[#fffaf0] px-4 text-[15px] font-semibold text-[#2c2941] outline-none transition-shadow placeholder:text-[#aaa1a2] focus:border-[#d94e72] focus:ring-4 focus:ring-[#d94e72]/15"
      />
    </label>
  );
}

function Home() {
  const [, setLocation] = useLocation();
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanName = playerName.trim();
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanName.length < 1) {
      setError('أضف اسماً مستعاراً حتى يعرف أصدقاؤك من أنت.');
      return;
    }
    if (mode === 'join' && cleanCode.length < 1) {
      setError('أدخل كود الغرفة أولاً.');
      return;
    }
    if (mode === 'create') {
      createRoom.mutate({ data: { playerName: cleanName, maxPlayers } }, {
        onSuccess: (room) => {
          localStorage.setItem(playerStorageKey(room.roomCode), room.viewerPlayerId);
          setLocation(`/room/${room.roomCode}`);
        },
        onError: (mutationError) => setError(friendlyError(mutationError)),
      });
    } else {
      joinRoom.mutate({ roomCode: cleanCode, data: { playerName: cleanName } }, {
        onSuccess: (room) => {
          localStorage.setItem(playerStorageKey(room.roomCode), room.viewerPlayerId);
          setLocation(`/room/${room.roomCode}`);
        },
        onError: (mutationError) => setError(friendlyError(mutationError)),
      });
    }
  };

  const pending = createRoom.isPending || joinRoom.isPending;
  return (
    <main className="zamrat-shell relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#716977] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#bad943]" />
            بدون حسابات. فقط أصدقاء.
          </div>
        </header>

        <section className="grid items-center gap-12 pb-16 pt-14 md:grid-cols-[1.02fr_.98fr] md:gap-8 md:pb-24 md:pt-20">
          <div className="animate-rise">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9cfbd] bg-[#fffaf0]/70 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.16em] text-[#867a78]">
              <span className="h-2 w-2 rounded-full bg-[#d94e72]" />
              لعبة فواكه جماعية للأصدقاء
            </p>
            <h1 className="display-font max-w-xl text-[clamp(3.7rem,9vw,7.4rem)] font-extrabold leading-[.87] tracking-[-.09em] text-[#2c2941]">
              مرّرها.<br /><span className="text-[#d94e72]">طابقها.</span><br />زمرت.
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-[#665f6e] sm:text-lg">
              لعبة ورق سريعة وممتعة. أنشئ غرفة، شارك الكود، واعرف من يجمع نفس الفاكهة أولاً.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-bold text-[#665f6e]">
              <span className="rounded-full bg-[#dff09a] px-3 py-2">انضم في أقل من ٣٠ ثانية</span>
              <span className="rounded-full bg-[#d5f0ed] px-3 py-2">٣–١٠ لاعبين</span>
            </div>
          </div>

          <div className="animate-rise [animation-delay:120ms]">
            <div className="fruit-orbit animate-bob" aria-hidden="true">
              <div className="fruit-blob one">كيوي</div>
              <div className="fruit-blob two">توت</div>
              <div className="fruit-blob three">بطيخ</div>
              <div className="fruit-blob four">ليمون</div>
              <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] place-items-center rounded-[2rem] border-2 border-[#2c2941] bg-[#fffaf0] text-center shadow-[8px_9px_0_#2c2941]">
                <span className="display-font text-4xl font-extrabold leading-none text-[#d94e72]">ز</span>
                <span className="mono-font -mt-1 text-[8px] font-bold tracking-[.18em] text-[#716977]">طابق السرب</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl" aria-label="أدخل غرفة">
          <div className="game-card border-2 border-[#2c2941] p-5 shadow-[8px_8px_0_#2c2941] sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mono-font text-[11px] font-medium uppercase tracking-[.16em] text-[#867a78]">دورك الآن</p>
                <h2 className="display-font mt-1 text-2xl font-extrabold tracking-[-.05em]">أنشئ غرفة أو انضم لإحداها</h2>
              </div>
              <div className="flex rounded-xl bg-[#eee6d9] p-1">
                <button onClick={() => setMode('create')} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition-colors ${mode === 'create' ? 'bg-[#fffaf0] text-[#2c2941] shadow-sm' : 'text-[#867a78]'}`} data-testid="tab-create-room">إنشاء</button>
                <button onClick={() => setMode('join')} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition-colors ${mode === 'join' ? 'bg-[#fffaf0] text-[#2c2941] shadow-sm' : 'text-[#867a78]'}`} data-testid="tab-join-room">انضمام</button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField label="الاسم المستعار" value={playerName} onChange={setPlayerName} placeholder="مثلاً: أبو بطيخ" maxLength={18} autoFocus testId="input-player-name" />
              {mode === 'create' ? (
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-[.12em] text-[#716977]">عدد اللاعبين</span>
                  <select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} data-testid="select-max-players" className="h-12 w-full rounded-xl border border-[#dfd5c4] bg-[#fffaf0] px-4 text-sm font-semibold text-[#2c2941] outline-none focus:border-[#d94e72] focus:ring-4 focus:ring-[#d94e72]/15">
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((count) => <option key={count} value={count}>{count} لاعبين</option>)}
                  </select>
                </label>
              ) : (
                <TextField label="كود الغرفة" value={roomCode} onChange={(value) => setRoomCode(value.toUpperCase())} placeholder="مثلاً: PULP7" maxLength={8} testId="input-room-code" />
              )}
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? <Sparkles className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {pending ? 'لحظة…' : mode === 'create' ? 'إنشاء غرفة' : 'انضم للغرفة'}
              </Button>
            </form>
            {error && <p className="mt-4 rounded-lg bg-[#fde3df] px-3 py-2 text-sm font-semibold text-[#a63c36]" role="alert" data-testid="status-home-error">{error}</p>}
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-5xl gap-4 border-t border-[#dfd5c4] pt-7 sm:grid-cols-3 sm:gap-8">
          {[
            ['٠١', 'شارك كوداً صغيراً', 'بدون تسجيل أو إعداد ملف شخصي. فقط أرسل كود الغرفة لأصدقائك.'],
            ['٠٢', 'مرّر البطاقة الصحيحة', 'اختر فاكهة من يدك ومرّرها حول الطاولة.'],
            ['٠٣', 'نادِ بـ زمرت!', 'حين تتطابق يدك، نادِ أولاً. السريع يفوز بالكبير.'],
          ].map(([number, title, copy]) => (
            <div key={number} className="animate-rise" data-testid={`feature-${number}`}>
              <p className="mono-font text-xs text-[#d94e72]">{number} /</p>
              <h3 className="display-font mt-2 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#716977]">{copy}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Avatar({ player, size = 'md' }: { player: PlayerView; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-16 w-16 text-xl' };
  return <div className={`${sizes[size]} grid shrink-0 place-items-center rounded-2xl bg-[#dff09a] font-extrabold text-[#2c2941] ring-2 ring-[#fffaf0]`} data-testid={`img-avatar-${player.id}`}>{player.avatar || player.name.slice(0, 1).toUpperCase()}</div>;
}

function PlayerList({ players, viewerId, showCards = false }: { players: PlayerView[]; viewerId: string; showCards?: boolean }) {
  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div key={player.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${player.id === viewerId ? 'border-[#bad943] bg-[#f3f8d8]' : 'border-[#eadfce] bg-[#fffaf0]/70'}`} data-testid={`player-row-${player.id}`}>
          <Avatar player={player} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold">{player.name}</p>
              {player.isHost && <Crown className="h-3.5 w-3.5 text-[#d99827]" />}
              {player.id === viewerId && <span className="text-[10px] font-extrabold uppercase text-[#5e7a1b]">أنت</span>}
            </div>
            <p className="text-xs text-[#867a78]">{player.isReady ? 'جاهز للعب' : 'يستعد...'}</p>
          </div>
          {showCards && <span className="mono-font text-xs text-[#867a78]" data-testid={`text-card-count-${player.id}`}>{player.cardCount} بطاقات</span>}
          <span className="mono-font min-w-8 text-right text-xs font-bold text-[#d94e72]" data-testid={`text-player-score-${player.id}`}>{player.score}</span>
        </div>
      ))}
    </div>
  );
}

const ARABIC_FRUITS: Record<string, string> = {
  berry: 'توت', grape: 'عنب', lime: 'ليمون', kiwi: 'كيوي',
  melon: 'بطيخ', mango: 'مانجو', cherry: 'كرز', apple: 'تفاح',
  orange: 'برتقال', peach: 'خوخ', pear: 'إجاص', pineapple: 'أناناس',
  watermelon: 'بطيخ أحمر', strawberry: 'فراولة', banana: 'موز', lemon: 'ليمون',
  plum: 'خوخ بنفسجي', coconut: 'جوز هند', guava: 'جوافة', fig: 'تين',
};

function getFruitName(value: string): string {
  const lower = value.replace(/[_-]/g, ' ').toLowerCase();
  for (const [en, ar] of Object.entries(ARABIC_FRUITS)) {
    if (lower.includes(en)) return ar;
  }
  return value.replace(/[_-]/g, ' ');
}

function FruitCard({ value, index, selected, onSelect }: { value: string; index: number; selected: boolean; onSelect: () => void }) {
  const name = value.replace(/[_-]/g, ' ');
  const lower = name.toLowerCase();
  const color = lower.includes('berry') || lower.includes('grape') ? '#d94e72'
    : lower.includes('lime') || lower.includes('kiwi') ? '#bad943'
    : lower.includes('melon') ? '#f4ad43'
    : '#67c9c0';
  const displayName = getFruitName(value);
  return (
    <button onClick={onSelect} className={`game-card hand-card flex flex-col items-center justify-between p-3 text-center ${selected ? 'selected' : ''}`} style={{ animationDelay: `${index * 70}ms` }} data-testid={`card-hand-${index}`} aria-pressed={selected}>
      <span className="mono-font self-start text-[10px] text-[#aaa1a2]">{String(index + 1).padStart(2, '0')}</span>
      <span className="grid h-14 w-14 place-items-center rounded-full text-[9px] font-extrabold tracking-wide text-[#2c2941]" style={{ backgroundColor: color }}>{name.slice(0, 2).toUpperCase()}</span>
      <span className="text-xs font-extrabold text-[#2c2941]">{displayName}</span>
      {selected && <span className="absolute right-2 top-2 rounded-full bg-[#d94e72] p-1 text-[#fffaf0]"><Check className="h-3 w-3" /></span>}
    </button>
  );
}

function RoomLoading() {
  return (
    <main className="zamrat-shell min-h-[100dvh] p-5">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-9 w-28 rounded-lg bg-[#e9dfce]" />
        <div className="mt-14 grid gap-5 md:grid-cols-[1fr_2fr]">
          <div className="h-72 rounded-2xl bg-[#eee6d9]" />
          <div className="h-[28rem] rounded-2xl bg-[#eee6d9]" />
        </div>
      </div>
    </main>
  );
}

function JoinFromLink({ roomCode, maxPlayers, onJoined, error }: { roomCode: string; maxPlayers?: number; onJoined: (room: RoomView) => void; error: string }) {
  const joinRoom = useJoinRoom();
  const [name, setName] = useState('');
  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    joinRoom.mutate({ roomCode, data: { playerName: name.trim() } }, {
      onSuccess: (room) => {
        localStorage.setItem(playerStorageKey(roomCode), room.viewerPlayerId);
        onJoined(room);
      },
    });
  };
  return (
    <main className="zamrat-shell flex min-h-[100dvh] items-center justify-center p-5">
      <div className="game-card w-full max-w-md border-2 border-[#2c2941] p-7 shadow-[8px_8px_0_#2c2941]">
        <Logo />
        <p className="mono-font mt-10 text-xs uppercase tracking-[.16em] text-[#867a78]">تمت دعوتك إلى</p>
        <h1 className="display-font mt-2 text-4xl font-extrabold tracking-[-.06em]">غرفة {roomCode}</h1>
        <p className="mt-3 text-sm leading-6 text-[#716977]">
          اختر اسماً مستعاراً واجلس.{maxPlayers ? ` يمكن لـ ${maxPlayers} لاعبين الانضمام.` : ''}
        </p>
        <form onSubmit={handleJoin} className="mt-7 space-y-4">
          <TextField label="الاسم المستعار" value={name} onChange={setName} placeholder="مثلاً: أبو ليمون" maxLength={18} autoFocus testId="input-room-join-name" />
          <Button type="submit" className="w-full" disabled={joinRoom.isPending}>
            {joinRoom.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            احجز مقعدك
          </Button>
        </form>
        {(error || joinRoom.error) && (
          <p className="mt-4 rounded-lg bg-[#fde3df] px-3 py-2 text-sm font-semibold text-[#a63c36]" role="alert" data-testid="status-room-join-error">
            {error || friendlyError(joinRoom.error)}
          </p>
        )}
      </div>
    </main>
  );
}

function RoomPage() {
  const { roomCode: routeCode = '' } = useParams<{ roomCode: string }>();
  const roomCode = routeCode.toUpperCase();
  const queryClient = useQueryClient();
  const [playerId, setPlayerId] = useState(() => localStorage.getItem(playerStorageKey(roomCode)) || '');
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const roomQuery = useGetRoom(roomCode, {
    query: {
      queryKey: getGetRoomQueryKey(roomCode),
      enabled: Boolean(playerId),
      refetchInterval: playerId ? 1500 : false,
    },
    request: {
      headers: playerId ? { 'X-Player-Id': playerId } : undefined,
    },
  });
  const startRoom = useStartRoom();
  const passCard = usePassCard();
  const callZamrat = useCallZamrat();
  const room = roomQuery.data;

  useEffect(() => {
    document.title = room ? `غرفة ${room.roomCode} — زمرت` : 'جارٍ الانضمام — زمرت';
  }, [room]);

  const refreshAfter = () => {
    setSelectedCard(null);
    setActionError('');
    queryClient.invalidateQueries({ queryKey: getGetRoomQueryKey(roomCode) });
  };

  const runAction = (action: () => void) => {
    setActionError('');
    try { action(); } catch (error) { setActionError(friendlyError(error)); }
  };

  if (!playerId) return (
    <JoinFromLink
      roomCode={roomCode}
      onJoined={(joined) => {
        setPlayerId(joined.viewerPlayerId);
        queryClient.setQueryData(getGetRoomQueryKey(roomCode), joined);
      }}
      error={actionError}
    />
  );
  if (roomQuery.isLoading) return <RoomLoading />;
  if (roomQuery.error && !room) {
    return (
      <main className="zamrat-shell flex min-h-[100dvh] items-center justify-center p-5">
        <div className="game-card max-w-md p-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fde3df] text-[#a63c36]"><X /></div>
          <h1 className="display-font mt-5 text-2xl font-extrabold">الغرفة غير موجودة</h1>
          <p className="mt-2 text-sm leading-6 text-[#716977]">{friendlyError(roomQuery.error)}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => roomQuery.refetch()} data-testid="button-retry-room">
              <RefreshCw className="h-4 w-4" />أعد المحاولة
            </Button>
            <Link href="/" className="tactile inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d94e72] px-4 py-2 text-sm font-bold text-[#fffaf0] shadow-[0_5px_0_#a83255]" data-testid="link-back-home">
              عودة للرئيسية
            </Link>
          </div>
        </div>
      </main>
    );
  }
  if (!room) return <RoomLoading />;

  const viewerId = playerId || room.viewerPlayerId;
  const isActive = room.activePlayerId === viewerId;
  const winner = room.players.find((player) => player.id === room.winnerId);
  const handleStart = () => runAction(() => startRoom.mutate(
    { roomCode, data: { playerId: viewerId } },
    { onSuccess: refreshAfter, onError: (error) => setActionError(friendlyError(error)) },
  ));
  const handlePass = () => {
    if (selectedCard === null) {
      setActionError('اختر بطاقة لتمريرها أولاً.');
      return;
    }
    runAction(() => passCard.mutate(
      { roomCode, data: { playerId: viewerId, cardIndex: selectedCard } },
      { onSuccess: refreshAfter, onError: (error) => setActionError(friendlyError(error)) },
    ));
  };
  const handleZamrat = () => runAction(() => callZamrat.mutate(
    { roomCode, data: { playerId: viewerId } },
    { onSuccess: refreshAfter, onError: (error) => setActionError(friendlyError(error)) },
  ));
  const mutationPending = startRoom.isPending || passCard.isPending || callZamrat.isPending;

  return (
    <main className="zamrat-shell relative min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-7 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfd5c4] pb-5">
          <Logo />
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-[#dfd5c4] bg-[#fffaf0]/75 px-3 py-2 text-center">
              <p className="mono-font text-[9px] uppercase tracking-[.16em] text-[#867a78]">كود الغرفة</p>
              <p className="mono-font text-sm font-bold tracking-[.14em]" data-testid="text-room-code">{room.roomCode}</p>
            </div>
            <CopyRoomCode roomCode={room.roomCode} />
          </div>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr_280px]">
          <aside className="order-2 lg:order-1">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="mono-font text-[10px] uppercase tracking-[.16em] text-[#867a78]">الطاولة</p>
                <h2 className="display-font text-xl font-extrabold">
                  اللاعبون <span className="text-[#d94e72]">{room.players.length}/{room.maxPlayers}</span>
                </h2>
              </div>
              <Users className="h-5 w-5 text-[#867a78]" />
            </div>
            <PlayerList players={room.players} viewerId={viewerId} showCards={room.status === 'playing'} />
            {room.status === 'waiting' && room.canStart && (
              <Button onClick={handleStart} disabled={mutationPending} variant="lime" className="mt-4 w-full" data-testid="button-start-room">
                <Play className="h-4 w-4 fill-current" />ابدأ اللعبة
              </Button>
            )}
            {room.status === 'waiting' && !room.canStart && (
              <p className="mt-4 rounded-xl bg-[#eee6d9] px-3 py-3 text-center text-xs font-semibold leading-5 text-[#716977]" data-testid="status-waiting-room">
                في انتظار المضيف لبدء اللعبة.
              </p>
            )}
          </aside>

          <section className="order-1 min-w-0 lg:order-2">
            {room.status === 'waiting' && <WaitingRoom room={room} />}
            {room.status === 'playing' && (
              <PlayingRoom
                room={room}
                selectedCard={selectedCard}
                setSelectedCard={setSelectedCard}
                isActive={isActive}
                onPass={handlePass}
                onZamrat={handleZamrat}
                pending={mutationPending}
              />
            )}
            {room.status === 'finished' && <FinishedRoom room={room} winner={winner} />}
            {actionError && (
              <p className="mt-4 rounded-xl border border-[#e9b5aa] bg-[#fde3df] px-4 py-3 text-sm font-semibold text-[#a63c36]" role="alert" data-testid="status-room-action-error">
                {actionError}
              </p>
            )}
          </section>

          <aside className="order-3">
            <Feed feed={room.feed} status={room.status} />
          </aside>
        </div>
      </div>
    </main>
  );
}

function CopyRoomCode({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button onClick={copy} variant="secondary" className="min-h-[48px] px-3" data-testid="button-copy-room-code">
      {copied ? <Check className="h-4 w-4 text-[#5e7a1b]" /> : <Clipboard className="h-4 w-4" />}
      <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
    </Button>
  );
}

function WaitingRoom({ room }: { room: RoomView }) {
  return (
    <div className="game-card animate-rise min-h-[26rem] overflow-hidden border-2 border-[#2c2941] p-6 sm:p-10">
      <div className="relative z-10">
        <p className="mono-font text-xs uppercase tracking-[.18em] text-[#867a78]">الجولة {String(room.round).padStart(2, '0')} / قبل البدء</p>
        <h1 className="display-font mt-4 max-w-lg text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-[.9] tracking-[-.08em]">
          شارك الكود.<br /><span className="text-[#d94e72]">اجمع الفواكه.</span>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-6 text-[#716977]">
          الطاولة جاهزة. حين يجلس الجميع، يمكن للمضيف توزيع أول يد.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="flex -space-x-2">
            {room.players.map((player) => <Avatar key={player.id} player={player} size="md" />)}
          </div>
          <span className="text-sm font-bold text-[#665f6e]">
            {room.players.length === 1 ? 'أنت أول من انضم.' : `${room.players.length} لاعبين في الغرفة.`}
          </span>
        </div>
      </div>
      <div className="absolute -bottom-16 -right-12 h-64 w-64 rotate-12 rounded-[35%] bg-[#dff09a]" />
      <div className="absolute -right-4 top-10 h-24 w-24 rounded-full bg-[#f4ad43] opacity-70" />
    </div>
  );
}

function PlayingRoom({
  room, selectedCard, setSelectedCard, isActive, onPass, onZamrat, pending,
}: {
  room: RoomView; selectedCard: number | null; setSelectedCard: (index: number) => void;
  isActive: boolean; onPass: () => void; onZamrat: () => void; pending: boolean;
}) {
  return (
    <div className="animate-rise">
      <div className={`game-card mb-5 flex items-center justify-between gap-4 border-2 p-4 ${isActive ? 'border-[#bad943] bg-[#f5f9dd]' : 'border-[#dfd5c4]'}`} data-testid="status-turn">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${isActive ? 'animate-pulse-ring bg-[#bad943]' : 'bg-[#dfd5c4]'}`} />
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-[#867a78]">الجولة {room.round}</p>
            <p className="text-sm font-extrabold">{isActive ? 'دورك — اختر بطاقة لتمريرها' : 'الطاولة تتحرك'}</p>
          </div>
        </div>
        {isActive && (
          <span className="hidden rounded-full bg-[#dff09a] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#5e7a1b] sm:inline">
            الحركة لك
          </span>
        )}
      </div>
      <div className="game-card border-2 border-[#2c2941] p-4 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-font text-[10px] uppercase tracking-[.16em] text-[#867a78]">يدك</p>
            <h1 className="display-font mt-1 text-3xl font-extrabold tracking-[-.06em]">اختر فاكهة</h1>
          </div>
          <span className="rounded-lg bg-[#eee6d9] px-2 py-1 text-xs font-bold text-[#716977]" data-testid="text-hand-count">
            {room.hand.length} بطاقات
          </span>
        </div>
        {room.hand.length > 0 ? (
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {room.hand.map((card, index) => (
              <FruitCard
                key={`${card}-${index}`}
                value={card}
                index={index}
                selected={selectedCard === index}
                onSelect={() => setSelectedCard(index)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-xl bg-[#eee6d9] p-8 text-center text-sm font-semibold text-[#716977]">
            يدك فارغة الآن.
          </div>
        )}
        <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Button onClick={onPass} disabled={!isActive || selectedCard === null || pending} className="w-full" data-testid="button-pass-card">
            <Send className="h-4 w-4" />
            {pending ? 'جارٍ التمرير…' : selectedCard === null ? 'اختر بطاقة لتمريرها' : 'مرّر هذه البطاقة'}
          </Button>
          <Button onClick={onZamrat} disabled={!room.canCallZamrat || pending} variant="lime" className="w-full sm:w-auto" data-testid="button-call-zamrat">
            <Sparkles className="h-4 w-4" />زمرت!
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinishedRoom({ room, winner }: { room: RoomView; winner?: PlayerView }) {
  return (
    <div className="game-card animate-rise overflow-hidden border-2 border-[#2c2941] p-6 text-center sm:p-10">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-[#dff09a] text-3xl shadow-[5px_5px_0_#2c2941]">
        <Sparkles />
      </div>
      <p className="mono-font mt-8 text-xs uppercase tracking-[.18em] text-[#867a78]">الجولة {room.round} اكتملت</p>
      <h1 className="display-font mt-3 text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-none tracking-[-.08em]">
        <span className="text-[#d94e72]">{winner?.name || 'لاعب'}</span><br />نادى بزمرت!
      </h1>
      <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-[#716977]">
        تكلّمت الطاولة. تحقق من النتائج، ثم ابدأ جولة جديدة حين يكون المضيف جاهزاً.
      </p>
      <div className="mx-auto mt-8 max-w-sm divide-y divide-[#eadfce] rounded-xl border border-[#eadfce] bg-[#fffaf0]/70 text-right">
        {room.players.map((player, index) => (
          <div key={player.id} className="flex items-center gap-3 px-4 py-3" data-testid={`result-player-${player.id}`}>
            <span className="mono-font w-5 text-xs text-[#867a78]">{index + 1}</span>
            <Avatar player={player} size="sm" />
            <span className="flex-1 text-sm font-bold">{player.name}</span>
            <span className="mono-font text-sm font-bold text-[#d94e72]">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Feed({ feed, status }: { feed: string[]; status: RoomView['status'] }) {
  return (
    <div className="game-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[.16em] text-[#867a78]">البث المباشر</p>
          <h2 className="display-font text-xl font-extrabold">ماذا يحدث</h2>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${status === 'playing' ? 'animate-pulse-ring bg-[#bad943]' : 'bg-[#dfd5c4]'}`} />
      </div>
      {feed.length ? (
        <div className="space-y-3">
          {feed.slice(-8).reverse().map((item, index) => (
            <div key={`${item}-${index}`} className="flex gap-2.5 text-sm leading-5 text-[#665f6e]" data-testid={`feed-item-${index}`}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d94e72]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-[#eee6d9] px-3 py-5 text-center text-xs font-semibold leading-5 text-[#867a78]" data-testid="empty-feed">
          البث هادئ. الحركة الأولى لك.
        </div>
      )}
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/room/:roomCode" component={RoomPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppMeta />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;