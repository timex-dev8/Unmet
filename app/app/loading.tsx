import s from "./loading.module.css";

export default function Loading() {
  return (
    <div className={s.wrap} aria-hidden="true">
      <div className={s.title} />
      <div className={s.block} />
      <div className={s.block} />
      <div className={s.block} />
    </div>
  );
}
