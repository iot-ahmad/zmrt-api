# Zamrat — لعبة غرف الفواكه

لعبة فواكه جماعية تتيح للأصدقاء إنشاء غرفة ومشاركة كودها واللعب دون تسجيل دخول.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/zamrat` — واجهة React/Vite للصفحة الرئيسية، غرفة الانتظار، وحالة اللعب.
- `artifacts/api-server/src/routes/rooms.ts` — منطق الغرف والجولات والتمرير والنتائج.
- `lib/api-spec/openapi.yaml` — المصدر الوحيد لعقد API.
- `lib/api-client-react/src/generated` و`lib/api-zod/src/generated` — الملفات المولدة من العقد.

## Architecture decisions

- الغرف بدون حسابات: هوية اللاعب تُنشأ عند إنشاء/دخول الغرفة وتُحفظ محليًا للغرفة.
- حالة الغرف في الذاكرة حاليًا، لتبقى النسخة الأولى سريعة وبلا إعداد قاعدة بيانات؛ النشر طويل الأجل يحتاج مخزنًا مشتركًا.
- تمرير الأوراق متزامن منطقيًا: كل لاعب يختار ورقة، وبعد اكتمال الاختيارات تُمرر الأوراق إلى اللاعب السابق/التالي دفعة واحدة.
- الواجهة تستخدم polling لحالة الغرفة بدل WebSocket في النسخة الأولى، مع invalidation بعد كل حركة.

## Product

- إنشاء غرفة من الصفحة الرئيسية مع اسم مستعار وعدد لاعبين من 3 إلى 10.
- الانضمام بكود من 5 أحرف، غرفة انتظار، وبدء الجولة من المضيف.
- توزيع أوراق الفواكه، اختيار ورقة وتمريرها، ونداء Zamrat مع تسجيل النقاط.
- واجهة متجاوبة فاتحة مع metadata أساسية لمحركات البحث.

## User preferences

- الواجهة المطلوبة فاتحة، عصرية، وبدون تسجيل دخول؛ مشاركة الغرفة تكون عبر كود قصير.

## Gotchas

- أوامر بناء Vite المحلية تحتاج `PORT` و`BASE_PATH`؛ workflow يحقنهما تلقائيًا.
- بعد تعديل `lib/api-spec/openapi.yaml` يجب تشغيل codegen قبل استعمال hooks أو schemas جديدة.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
