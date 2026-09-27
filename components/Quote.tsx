"use client";

/* eslint-disable @next/next/no-img-element */
import { twMerge } from "tailwind-merge";

export function Quote({
  text,
  className,
  label,
  long = false,
}: {
  text: string;
  className?: string;
  label: string;
  long?: boolean;
}) {
  return (
    <div
      className={twMerge("relative", className)}
      aria-label={label}
      title={text}
    >
      <img
        className="block h-auto w-full [image-rendering:pixelated]"
        src={long ? "/art/quote-long.png" : "/art/quote.png"}
        alt=""
        width={100}
        height={100}
      />
      <p
        className={twMerge(
          "absolute m-0 flex items-center justify-center overflow-hidden text-center leading-tight text-ink",
          long
            ? "inset-x-[10%] top-[16%] bottom-[22%]"
            : "inset-x-[8%] top-[6%] bottom-[58%]",
        )}
      >
        <span className={long ? "line-clamp-5" : "line-clamp-3"}>{text}</span>
      </p>
    </div>
  );
}
