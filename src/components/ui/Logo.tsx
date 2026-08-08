import Image from 'next/image';

/**
 * The MyExams365 lockup.
 *
 * Two artwork files, swapped with CSS rather than by reading the theme in JS.
 * The brand navy sits at almost the same luminance as the dark-theme background
 * (#0B0C10), so on dark the book and the "E" would all but disappear — hence a
 * light variant. Doing the swap with `dark:` classes means both files are in the
 * markup and the correct one is shown before hydration, so there is no flash of
 * the wrong logo on first paint (which is what reading next-themes state here
 * would cause).
 */
export function Logo({
  className = 'h-8',
  priority = false,
  withWordmark = false,
}: {
  /** Height utility; width follows the aspect ratio. */
  className?: string;
  priority?: boolean;
  /**
   * Prints "MyExams365" beneath the mark. The mark alone reads as "ME 365",
   * which does not tell a first-time visitor what the product is called.
   */
  withWordmark?: boolean;
}) {
  const common = `w-auto ${className}`;
  const mark = (
    <>
      <Image
        src="/logo.png"
        alt="MyExams365"
        width={953}
        height={535}
        priority={priority}
        className={`${common} block dark:hidden`}
      />
      <Image
        src="/logo-dark.png"
        alt=""
        aria-hidden="true"
        width={953}
        height={535}
        priority={priority}
        className={`${common} hidden dark:block`}
      />
    </>
  );

  if (!withWordmark) return mark;

  return (
    <span className="inline-flex flex-col items-start leading-none">
      {mark}
      <span className="mt-1 text-[11px] sm:text-xs font-semibold tracking-[0.12em] uppercase text-[#111B35] dark:text-[#E2E8F0]">
        MyExams<span className="text-emerald-600 dark:text-emerald-400">365</span>
      </span>
    </span>
  );
}
