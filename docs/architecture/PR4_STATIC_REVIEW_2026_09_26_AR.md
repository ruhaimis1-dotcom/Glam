# مراجعة ثابتة لـmigration في PR #4 — 2026-09-26

المشروع المفحوص: `tevqysdswqkgqartpzdg` (GLAM). الفرع: `agent-os/p1.2-business-operations`؛ رأس بدء المراجعة `1213e1f96f0664b557fa0d51389979b14087b8c2`.

المرجع التاريخي: [تقرير 2026-09-25](PR4_REVIEW_2026_09_25_AR.md). الملف الجاري: `supabase/migrations/20260925205817_catalog_contract_and_visibility.sql`. لا تنطبق عبارات التقرير القديم «مقترح فقط» و«لم يُعَد فحص ACL» على حالة هذه المراجعة: الآن توجد migration محلية، وأعيدت قراءة السياسات وACL الفعلية، لكنها **لم تُطبق**.

## حدود التنفيذ والأدلة

جميع استعلامات الإنتاج كانت SELECT فقط على `information_schema`, `pg_catalog`, `pg_policies`، بالإضافة إلى ثلاثة counts لسلامة الروابط. استُخدمت `list_migrations` أيضًا. لم ننفذ DDL/DML أو دوال كتابة أو SET ROLE أو اختبارات معاملات على الإنتاج. لا نسخ لصفوف مستخدمين أو بيانات حجوزات؛ ملف الأدلة يحتوي metadata ونتائج مجمعة فقط.

الأدلة المحفوظة: [PR4_2026_09_26_catalog_metadata.json](evidence/PR4_2026_09_26_catalog_metadata.json). هذه لقطة وقت الفحص، وليست ضمانًا ضد تغيّر المخطط لاحقًا.

## تعارض مؤكد أُصلح في الملف

السياسة الحية `service_subcategories_managed_by_business_members` هي `ALL TO PUBLIC`، ويحتوي USING وWITH CHECK على استعلام `glam_memberships`. أثبت `has_table_privilege` أن anon لا يملك SELECT على ذلك الجدول. كانت migration تمنح anon قراءة التصنيفات الفرعية مع إبقاء هذه السياسة؛ إضافة سياسة permissive أخرى أو restrictive ceiling لا تزيل اعتماد السياسة القديمة على جدول العضويات.

الإصلاح المحدد، قبل منح القراءة العامة:

```sql
alter policy service_subcategories_managed_by_business_members
on public.glam_service_subcategories to authenticated;
```

تبقى تعبيرات الملكية نفسها، ولا تُمنح الزائرة قراءة العضويات، ولا تُحذف بقية السياسات. الاسم والدور مأخوذان من الكتالوج الحي، لا تخمينًا. إذا غابت السياسة في baseline أخرى، تفشل migration وتُراجع تلك البيئة بدل تجاهل الاختلاف.

هذا تعارض ثابت مؤكد بين نطاق السياسة وامتيازات اعتمادها. توقع فشل anonymous SELECT قبل الإصلاح مستند إلى قواعد PostgreSQL؛ **لم نُعد إنتاج خطأ runtime على قاعدة معزولة**. سياسات القراءة تعمل بامتيازات القارئ، وOR بين سياسات السماح لا يمنح امتيازات جدول مفقودة. [مرجع PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)

## ما ثبت بفحص المخطط

| المحور | النتيجة المثبتة | تقييم migration |
| --- | --- | --- |
| أعمدة الخدمات | `id/organization_id/name/minutes/price_sar/active/revision/category_id/subcategory_id/pricing_mode/buffer_minutes` موجودة بأنواع متوافقة | لا أعمدة P1 المفترضة أو الموازية |
| حدود القيم | الاسم 1–120، المدة 15–480 بخطوة 15، السعر 0–10000، buffer 0–120 | الدوال تعتمد القيود الحية؛ NULL المطلوبة مرفوضة |
| التسعير | `fixed/from/range/variants` | لا إدخال لقيمة `starts_from` المتعارضة |
| التصنيف | جدولان مستقلان؛ اسم الرئيسي 1–80 والفرعي 1–120 | يتطابق عقد الدوال مع هذه البنية |
| UNIQUE الحالية | خدمة باسم فريد داخل المؤسسة؛ تصنيف باسم فريد داخل المؤسسة؛ فرعي باسم فريد داخل المؤسسة والأب | التكرار قد يعيد 23505؛ لا ادعاء أن جميع الأسماء مقبولة |
| القيود والفهارس المقترحة | أسماء القيود الستة غير موجودة، ولا فهرسا UNIQUE بالاسمين الجديدين | لا تصادم أسماء وجدناه؛ تُنشأ UNIQUE قبل FK المركبة |
| علاقات الحذف | appointments وspecialists إلى الخدمة بلا cascade؛ variants وdelivery options مع cascade؛ category/subcategory إلى الخدمة SET NULL؛ parent إلى subcategory CASCADE | RPC يمنع حذف التصنيف المستخدم؛ القيود المركبة/CHECK تضيف حماية. تفاعل مسارات الحذف يحتاج اختبارًا |
| triggers | لا triggers مستخدم على جداول الكتالوج الأربعة | لا مضاعفة revision مع trigger موجود ظهر في الفحص |
| سلامة الروابط | counts الثلاثة = 0: service/category عبر مؤسسة، subcategory/parent عبر مؤسسة، service/subcategory بمؤسسة أو أب مختلف | فحص تمهيدي البيانات يطابق الحالة الحية وقت القراءة؛ ليس اختبار أقفال أو ضمانًا لوقت التطبيق |
| أسماء الدوال | الأربع العامة والأربع الخاصة و`catalog_row_visible` غير موجودة | CREATE لا يصطدم بدوال قائمة بالاسم في المخططين اللذين فُحصا |

## EXECUTE وملكية الدوال

- الموجود حيًا: `public.glam_add_service`, `public.glam_edit_service` وهما invoker؛ التطبيقان `glam_private.add_service/edit_service` هما definer بمالك postgres وsearch_path فارغ. authenticated يملك EXECUTE وanon لا يملكه. لا تدعم هذه العقود التصنيف/buffer، فلا تصلح بدل العقود الجديدة.
- migration تحافظ على هذه الدوال القديمة دون استبدال تواقيعها، وتضيف أربع wrappers invoker تستدعي أربع دوال definer متحققة من auth.uid() وعضوية owner/manager والمؤسسة ومعرّف الهدف.
- لكل توقيع كتابة جديد، يوجد REVOKE من PUBLIC/anon/authenticated ثم GRANT EXECUTE إلى authenticated في transaction واحدة. يحتاج invoker wrapper إلى تنفيذ التطبيق الخاص؛ لذلك منحه مقصود، وليس تجاوزًا لفحص العضوية.
- default ACL لدوال postgres في public يمنح postgres فقط؛ إعدادات supabase_admin مختلفة. لا نعتمد على هذه الافتراضات: REVOKE الصريح يغلق PUBLIC وanon حتى لو اختلفت defaults. يجب أن يكون منفذ migration مالكًا/دورًا إداريًا مناسبًا، وأن تتحقق ملكية الدوال بعد التطبيق.
- **تصحيح معلومة سابقة:** anon وauthenticated يملكان USAGE على `glam_private` بالفعل. عبارة «لا نضيف anon USAGE» لا تعني أنه غير موجود. لا أمن يعتمد على إخفاء اسم المخطط: دوال الكتابة محمية بـEXECUTE وفحص الهوية. `catalog_row_visible` مقصود أن يكون قابلًا للتنفيذ للدورين ويعيد boolean فقط.
- لا grants على مستوى الأعمدة ظهرت لجداول الكتالوج الأربعة. قراءة schema ACL لم تظهر CREATE لـanon/authenticated على public أو glam_private.

## RLS وأذونات الجداول

- الجداول السبعة ذات الصلة مملوكة لـpostgres، RLS مفعّل وFORCE RLS غير مفعّل. لا يمثل حساب postgres اختبارًا لصلاحيات العميلة.
- memberships SELECT للمستخدم نفسه؛ organizations SELECT للعضو؛ salon_pages published متاح قراءته للدورين، مع سياسة الإدارة لـauthenticated.
- services SELECT متاح للدورين، ولا INSERT/UPDATE/DELETE مباشر. سياسات النشر الحالية لا تشترط active، وهي permissive. إضافة ceiling restrictive في migration تمنع السياسات القديمة من توسيع القراءة فوق الحدود الجديدة.
- categories/subcategories/variants لا يملك anon أو authenticated SELECT عليها حاليًا. لقطة ACL تُظهر أيضًا امتيازات Dxtm (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) على هذه الجداول؛ REVOKE ALL المقترح يزيلها ويعيد SELECT فقط، ولا يكتفي بسحب INSERT/UPDATE/DELETE.
- كل سياسات الكتالوج التي ظهرت في الفحص permissive؛ لم نجد restrictive قائمة تتعارض بالاسم أو تضيق المسار الجديد. اعتماد السياسات بعد الإصلاح يسير categories ثم subcategories ثم services ثم variants، ولا توجد دورة في التعبيرات التي فُحصت.
- الحد المقترح: مالكة/مديرة المؤسسة ترى كتالوجها كاملًا؛ غيرهما يرى النشط لمؤسسة active ذات صفحة published، مع نشاط التصنيف وأبيه. هذا يضيّق قراءة المختصة مقارنة بسياسة service_member السابقة؛ قرار سلوكي معلن يحتاج اختبار قبول.
- دالة الرؤية definer تقرأ المؤسسات والعضويات دون منح anon قراءتهما. هذا لا يثبت إغلاق RPCs القديمة التي تعمل كـdefiner، ولا يمنع وحده الحجز على موعد قديم لخدمة معطلة.

## سجل migrations وترتيب التطبيق

1. السجل الحي يحتوي **55 migration**؛ آخرها `20260923214630 seed_initial_service_catalog_categories`، وقبلها `20260923214122 add_service_subcategories_and_delivery_options`.
2. `20260925205817_catalog_contract_and_visibility` غير مطبقة، وP1 المؤرشفة غير موجودة في السجل. لذلك تعديل ملف migration غير المطبق مناسب؛ لا تعديل لسجل أو تاريخ منشور.
3. runner المحلي يحتوي ملف SQL واحدًا فقط، وهو الجديد. P1 القديمة موجودة في `docs/sql/archive/`، والمقترح superseded في `docs/sql/`؛ لا يدخلان ترتيب migrations. ملف الاختبار في `supabase/tests/` وليس migration.
4. يلزم baseline حية كاملة على بيئة معزولة أولًا. لا يصلح تشغيل الملف الجديد فوق قاعدة فارغة، ولا يجوز إسكات اختلاف الـ55 migration بـ`migration repair` عشوائيًا. لا نعتمد `db push` من هذا المستودع قبل توفيق التاريخ.
5. داخل الملف: transaction/مهلات → فحص الروابط → UNIQUE → FK/CHECK → الدوال الخاصة → wrappers → EXECUTE → دالة الرؤية → RLS وتصحيح نطاق السياسة القديمة → table grants → سياسات السماح والحدود → إخطار PostgREST → commit.
6. CREATE FUNCTION/CONSTRAINT/POLICY ليست idempotent؛ التشغيل مرة واحدة عبر سجل migration هو المقصود. لا تختبر إعادة التنفيذ على الإنتاج.

## الفحوصات والحد الفاصل

أُضيفت ثلاثة اختبارات Node ثابتة: ربط التصحيح بلقطة السياسة/ACL الحية وترتيبه قبل GRANT، فحص منع EXECUTE العام لكل تواقيع الكتابة الثمانية، ومنع عودة SQL التاريخية إلى runner. هذه حواجز نصية وليست parser أو محاكي PostgreSQL.

وُسّع `supabase/tests/catalog_contract.sql` ليفحص ACL الثمانية (بما فيها PUBLIC عبر aclexplode)، وعدم منح anon قراءة العضويات، وقراءة الزائرة للتصنيف الفرعي وخدمة مرتبطة به. **هذا script لم يُنفذ.**

النتائج المحلية: 32 اختبارًا ناجحًا، TypeScript والبناء ناجحان. ESLint: صفر أخطاء و10 تحذيرات Fast Refresh سابقة. فحص الفروق `git diff --check` ناجح. نجاح هذه الفحوصات لا يثبت صحة تنفيذ SQL.

لا يمكن إثبات الآتي دون PostgreSQL معزول: قبول migration كاملة، سلوك RLS المركب وEXECUTE بهويات فعلية، تطابق REST/schema cache، تفاعل FK عند الحذف، سحب العضوية المتزامن والأقفال والمهلات، صلاحية بيانات fixtures، سلوك الدوال القديمة ومسار الحجز بعد تعطيل خدمة، أو الأداء. ويظل expected revision/idempotency خارج الإصلاح.

**القرار:** أُصلح التعارض المؤكد في الملف على فرع PR #4، ولم يظهر تعارض أسماء/أعمدة آخر في نطاق الفحص. PR يبقى للمراجعة؛ لا موافقة على التطبيق أو الدمج حتى نجاح اختبار قاعدة معزولة.

## فحص متابعة للكتالوج والحجز — 2026-09-26

أُعيدت القراءة فقط من مشروع GLAM نفسه `tevqysdswqkgqartpzdg`. لم يُطبّق SQL أو تُنفذ دالة كتابة. آخر migration حية لا تزال `20260923214630`، ودوال `glam_save_catalog_*` و`glam_delete_catalog_*` لم تظهر في قاعدة GLAM.

فحص تمهيدي مجمّع للروابط أعاد صفرًا في الحالات الثلاث: خدمة مرتبطة بتصنيف من مؤسسة أخرى، تصنيف فرعي بأب من مؤسسة أخرى، وخدمة مرتبطة بتصنيف فرعي من مؤسسة/أب غير مطابقين. كذلك لم تُوجد خدمة نشطة داخل تصنيف رئيسي غير نشط وقت الفحص. هذه لقطة وقتية، وتعيد migration فحصها عند التطبيق.

فُحصت تعريفات الدوال الحية `glam_private.salon_page` و`glam_private.salon_slots` و`glam_private.available_appointments` ومحفز `glam_private.guard_catalog` على إدراج الحجز. تتحقق المسارات من نشاط الخدمة، وبعضها من revision والتعيين للمختصة، لكنها لا تتحقق من نشاط التصنيف الرئيسي أو الفرعي. لذلك قد تظل خدمة نشطة مرتبطة بتصنيف معطّل ظاهرة عبر دالة صفحة الصالون أو قابلة للحجز من موعد سابق، حتى إذا أخفتها سياسات قراءة الجداول الجديدة. هذا استنتاج من تعريف الدوال، ولم يُختبر بسجل حجز فعلي. `glam_service_delivery_options` لا يملك anon أو authenticated عليه SELECT حاليًا، لذا لا نعدّ سياسة قراءته وحدها تسربًا مثبتًا.

بوابة الاختبار الإضافية على نسخة GLAM المعزولة: إنشاء تصنيف رئيسي وفرعي وخدمة نشطة وموعد صالح، ثم تعطيل الفرعي والرئيسي كل على حدة، وفحص قراءة REST والدوال العامة للصالون والمواعيد ورفض إدراج حجز جديد عبر محفز الحجز. بعد إعادة التفعيل يجب إعادة التحقق من السلوك المتوقع مع revision والمواعيد القائمة. أي إصلاح لدوال الحجز القديمة أو صلاحيات جدول خيارات التقديم يحتاج migration مراجعة واختبارًا منفصلًا، ولا يُطبّق على المشروع الحي ضمن هذه المراجعة.
