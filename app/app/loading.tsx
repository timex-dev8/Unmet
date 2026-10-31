import s from "./loading.module.css";

// Shown while a Studio screen loads: a quiet outline of a title and three cards.
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
