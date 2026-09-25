import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { useBusinessOrganization } from "@/lib/business-context";
import { supabase } from "@/lib/supabase";
import { createCatalogRepository } from "@/repositories/service-intelligence";
import { catalogError, type CatalogService, type ServiceInput } from "@/domain/business-catalog";

export const Route = createFileRoute("/business/services")({ component: ServicesPage });
const repository = createCatalogRepository(supabase);
const emptyService: ServiceInput = {
  name: "",
  minutes: 60,
  price_sar: 0,
  active: false,
  category_id: null,
  subcategory_id: null,
  pricing_mode: "fixed",
  buffer_minutes: 0,
};
const fieldClass = "mt-2 w-full rounded-2xl border bg-background px-4 py-3";
const buttonClass = "rounded-full border px-4 py-2 text-sm disabled:opacity-40";
const primaryClass = `${buttonClass} bg-primary text-primary-foreground`;
type Catalog = Awaited<ReturnType<typeof repository.load>>;

function ServicesPage() {
  const organization = useBusinessOrganization();
  const [catalog, setCatalog] = useState<Catalog>({
    services: [],
    categories: [],
    subcategories: [],
  });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutation = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editor, setEditor] = useState<{ id: string | null; input: ServiceInput } | null>(null);
  const [step, setStep] = useState(1);
  const [categoryEditor, setCategoryEditor] = useState<{
    id: string | null;
    name: string;
    parent: string | null;
  } | null>(null);
  const mounted = useRef(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setLoaded(false);
    try {
      const data = await repository.load(organization.id);
      if (mounted.current) {
        setCatalog(data);
        setLoaded(true);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [organization.id]);
  useEffect(() => {
    mounted.current = true;
    void reload().catch((failure: unknown) => {
      if (mounted.current) setError(catalogError(failure));
    });
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  async function runMutation(action: () => Promise<unknown>) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (!mounted.current) return;
      setEditor(null);
      setCategoryEditor(null);
      setNotice("تم الحفظ في المؤسسة.");
      try {
        await reload();
      } catch (failure) {
        setNotice("تم الحفظ، لكن تعذر تحديث القائمة. أعيدي تحميلها قبل إجراء تغيير آخر.");
        throw failure;
      }
    } catch (failure) {
      if (mounted.current) setError(catalogError(failure));
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function edit(service?: CatalogService) {
    setError("");
    setNotice("");
    setStep(1);
    setEditor({ id: service?.id ?? null, input: service ? { ...service } : { ...emptyService } });
  }
  function patch(input: Partial<ServiceInput>) {
    setEditor((current) =>
      current ? { ...current, input: { ...current.input, ...input } } : null,
    );
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (editor)
      void runMutation(() => repository.saveService(organization.id, editor.id, editor.input));
  }
  const services = catalog.services.filter(
    (service) =>
      service.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (status === "all" || service.active === (status === "active")) &&
      (!categoryFilter || service.category_id === categoryFilter),
  );
  const disabled = busy || loading || !loaded;

  return (
    <BusinessShell>
      <PageHeader
        title="الخدمات والتصنيفات"
        desc={organization.name}
        action={
          <button disabled={disabled} onClick={() => edit()} className={primaryClass}>
            <Plus className="inline size-4" /> إضافة خدمة
          </button>
        }
      />
      {error && (
        <div role="alert" className="glam-card mb-4 space-y-3 p-4 text-destructive">
          <p>{error}</p>
          <button
            disabled={busy || loading}
            className={buttonClass}
            onClick={() => {
              setError("");
              void reload().catch((failure: unknown) => setError(catalogError(failure)));
            }}
          >
            إعادة تحميل البيانات
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-4 text-primary">
          {notice}
        </p>
      )}
      {loading && <p role="status">جارٍ تحميل كتالوج المؤسسة…</p>}
      {editor && (
        <form onSubmit={save} className="glam-card mb-6 p-5">
          <fieldset disabled={busy}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{editor.id ? "تعديل الخدمة" : "إضافة خدمة"}</h2>
              <button type="button" className={buttonClass} onClick={() => setEditor(null)}>
                إلغاء
              </button>
            </div>
            <div className="my-5 flex gap-2">
              {["الأساسيات", "السعر والوقت"].map((label, index) => (
                <button
                  type="button"
                  key={label}
                  className={step === index + 1 ? primaryClass : buttonClass}
                  onClick={() => setStep(index + 1)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div hidden={step !== 1} className="grid gap-4 md:grid-cols-2">
              <label>
                اسم الخدمة
                <input
                  required
                  maxLength={120}
                  className={fieldClass}
                  value={editor.input.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              <label>
                التصنيف الرئيسي
                <select
                  className={fieldClass}
                  value={editor.input.category_id ?? ""}
                  onChange={(e) =>
                    patch({ category_id: e.target.value || null, subcategory_id: null })
                  }
                >
                  <option value="">بدون تصنيف</option>
                  {catalog.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                التصنيف الفرعي
                <select
                  className={fieldClass}
                  value={editor.input.subcategory_id ?? ""}
                  disabled={!editor.input.category_id}
                  onChange={(e) => patch({ subcategory_id: e.target.value || null })}
                >
                  <option value="">بدون تصنيف فرعي</option>
                  {catalog.subcategories
                    .filter((category) => category.category_id === editor.input.category_id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editor.input.active}
                  onChange={(e) => patch({ active: e.target.checked })}
                />{" "}
                متاحة للحجز
              </label>
            </div>
            <div hidden={step !== 2} className="grid gap-4 md:grid-cols-2">
              <label>
                طريقة التسعير
                <select
                  className={fieldClass}
                  value={editor.input.pricing_mode}
                  onChange={(e) =>
                    patch({ pricing_mode: e.target.value as ServiceInput["pricing_mode"] })
                  }
                >
                  <option value="fixed">سعر ثابت</option>
                  <option value="from">يبدأ من</option>
                  {["range", "variants"].includes(editor.input.pricing_mode) && (
                    <option value={editor.input.pricing_mode}>إعداد متقدم محفوظ</option>
                  )}
                </select>
              </label>
              <label>
                السعر (ر.س)
                <input
                  required
                  type="number"
                  min={0}
                  max={10000}
                  step="0.01"
                  className={fieldClass}
                  value={editor.input.price_sar}
                  onChange={(e) => patch({ price_sar: e.target.valueAsNumber })}
                />
              </label>
              <label>
                المدة (دقيقة)
                <input
                  required
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  className={fieldClass}
                  value={editor.input.minutes}
                  onChange={(e) => patch({ minutes: e.target.valueAsNumber })}
                />
              </label>
              <label>
                وقت التجهيز (دقيقة)
                <input
                  required
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  className={fieldClass}
                  value={editor.input.buffer_minutes}
                  onChange={(e) => patch({ buffer_minutes: e.target.valueAsNumber })}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              {step === 1 ? (
                <button
                  type="button"
                  className={primaryClass}
                  onClick={() => {
                    if (editor.input.name.trim()) setStep(2);
                    else setError("أدخلي اسم الخدمة أولاً.");
                  }}
                >
                  التالي
                </button>
              ) : (
                <>
                  <button type="button" className={buttonClass} onClick={() => setStep(1)}>
                    السابق
                  </button>
                  <button disabled={disabled} className={primaryClass} type="submit">
                    {busy ? "جارٍ الحفظ…" : "حفظ الخدمة"}
                  </button>
                </>
              )}
            </div>
          </fieldset>
        </form>
      )}
      <section className="glam-card mb-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">تصنيفات المؤسسة</h2>
          <button
            disabled={disabled}
            className={buttonClass}
            onClick={() => setCategoryEditor({ id: null, name: "", parent: null })}
          >
            إضافة تصنيف
          </button>
        </div>
        {categoryEditor && (
          <form
            className="my-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runMutation(() =>
                repository.saveCategory(
                  organization.id,
                  categoryEditor.id,
                  categoryEditor.name,
                  categoryEditor.parent,
                ),
              );
            }}
          >
            <label>
              اسم التصنيف
              <input
                required
                disabled={busy}
                maxLength={categoryEditor.parent ? 120 : 80}
                className={fieldClass}
                value={categoryEditor.name}
                onChange={(e) => setCategoryEditor({ ...categoryEditor, name: e.target.value })}
              />
            </label>
            <button type="submit" disabled={disabled} className={primaryClass}>
              حفظ التصنيف
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={() => setCategoryEditor(null)}
            >
              إلغاء
            </button>
          </form>
        )}
        {!loading && loaded && !catalog.categories.length && (
          <p className="mt-3 text-muted-foreground">لا توجد تصنيفات بعد.</p>
        )}
        {catalog.categories.map((category) => (
          <div className="mt-4 border-t pt-3" key={category.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{category.name}</span>
              <button
                disabled={disabled}
                className={buttonClass}
                onClick={() =>
                  setCategoryEditor({ id: category.id, name: category.name, parent: null })
                }
              >
                تعديل
              </button>
              <button
                disabled={disabled}
                className={buttonClass}
                onClick={() => setCategoryEditor({ id: null, name: "", parent: category.id })}
              >
                إضافة فرعي
              </button>
              <button
                disabled={disabled}
                className={buttonClass}
                onClick={() => {
                  if (window.confirm(`حذف التصنيف «${category.name}»؟ يجب إزالة ارتباطاته أولاً.`))
                    void runMutation(() =>
                      repository.deleteCategory(organization.id, category.id, false),
                    );
                }}
              >
                حذف
              </button>
            </div>
            {catalog.subcategories
              .filter((sub) => sub.category_id === category.id)
              .map((sub) => (
                <div key={sub.id} className="ms-5 mt-2 flex flex-wrap items-center gap-2">
                  <span>{sub.name}</span>
                  <button
                    disabled={disabled}
                    className={buttonClass}
                    onClick={() =>
                      setCategoryEditor({ id: sub.id, name: sub.name, parent: category.id })
                    }
                  >
                    تعديل
                  </button>
                  <button
                    disabled={disabled}
                    className={buttonClass}
                    onClick={() => {
                      if (window.confirm(`حذف التصنيف الفرعي «${sub.name}»؟`))
                        void runMutation(() =>
                          repository.deleteCategory(organization.id, sub.id, true),
                        );
                    }}
                  >
                    حذف
                  </button>
                </div>
              ))}
          </div>
        ))}
      </section>
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="flex flex-1 items-center gap-2">
          <Search className="size-4" />
          <input
            aria-label="البحث عن خدمة"
            placeholder="ابحثي عن خدمة…"
            className={fieldClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="حالة الخدمة"
          className={buttonClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">كل الحالات</option>
          <option value="active">متاحة للحجز</option>
          <option value="inactive">غير متاحة</option>
        </select>
        <select
          aria-label="تصفية حسب التصنيف"
          className={buttonClass}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">كل التصنيفات</option>
          {catalog.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {!loading && loaded && !services.length && (
        <p className="glam-card p-5">لا توجد خدمات مطابقة. أضيفي خدمة أو غيّري البحث.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {services.map((service) => (
          <article className="glam-card p-5" key={service.id}>
            <h2 className="text-lg font-bold">{service.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {service.active ? "متاحة للحجز" : "غير متاحة للحجز"} ·{" "}
              {catalog.categories.find((category) => category.id === service.category_id)?.name ??
                "بدون تصنيف"}
              {service.subcategory_id
                ? ` / ${catalog.subcategories.find((category) => category.id === service.subcategory_id)?.name ?? "—"}`
                : ""}
            </p>
            <p className="my-4">
              {service.pricing_mode === "from" ? "يبدأ من " : ""}
              {service.price_sar} ر.س · {service.minutes} دقيقة · تجهيز {service.buffer_minutes}{" "}
              دقيقة
            </p>
            <div className="flex gap-2">
              <button disabled={disabled} className={buttonClass} onClick={() => edit(service)}>
                تعديل الخدمة
              </button>
              <button
                disabled={disabled}
                className={buttonClass}
                onClick={() => {
                  if (
                    window.confirm(`حذف الخدمة «${service.name}»؟ لا يمكن حذف خدمة مرتبطة بمواعيد.`)
                  )
                    void runMutation(() => repository.deleteService(organization.id, service.id));
                }}
              >
                حذف الخدمة
              </button>
            </div>
          </article>
        ))}
      </div>
    </BusinessShell>
  );
}
