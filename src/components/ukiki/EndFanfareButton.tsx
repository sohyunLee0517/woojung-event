"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ghostButton } from "./styles";

export default function EndFanfareButton({ code, id }: { code: string; id: number }) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  return (
    <button
      disabled={ending}
      onClick={async () => {
        setEnding(true);
        await fetch(`/api/ukiki/rooms/${code}/fanfare`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        }).catch(() => null);
        router.push(`/r/${code}`);
      }}
      style={{ ...ghostButton, color: "#f97316", opacity: ending ? 0.6 : 1 }}
    >
      {ending ? "끝내는 중…" : "빵빠레 끝내기"}
    </button>
  );
}
