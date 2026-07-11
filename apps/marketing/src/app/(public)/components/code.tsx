export function Code() {
    return (
        <div className="animate-[cfmFade_0.5s_ease] overflow-hidden rounded-[14px] bg-[#17191c] shadow-[0_24px_60px_rgba(16,24,40,0.18)]">
            <div className="flex items-center gap-1.5 border-b border-[#2a2d33] px-4 py-3">
                <span className="size-2.5 rounded-full bg-[#3a3e44]" />
                <span className="size-2.5 rounded-full bg-[#3a3e44]" />
                <span className="size-2.5 rounded-full bg-[#3a3e44]" />
                <span className="ml-2.5 font-mono text-[11px] text-[#8b9098]">
                    POST /v1/appointments
                </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-[1.75] whitespace-pre-wrap text-[#d7dbe2]">
                <span className="text-[#8b9098]">
                    {"// 202 Accepted — agendamento recebido:"}
                </span>
                {"\n{\n  "}
                <span className="text-[#7ea6f7]">{'"appointmentId"'}</span>
                {": "}
                <span className="text-[#9ece8f]">{'"cfm_a1b2c3"'}</span>
                {",\n  "}
                <span className="text-[#7ea6f7]">{'"patient"'}</span>
                {": "}
                <span className="text-[#9ece8f]">{'"Maria Silva"'}</span>
                {",\n  "}
                <span className="text-[#7ea6f7]">{'"status"'}</span>
                {": "}
                <span className="text-[#9ece8f]">{'"received"'}</span>
                {",\n  "}
                <span className="text-[#7ea6f7]">{'"scheduledFor"'}</span>
                {": "}
                <span className="text-[#9ece8f]">{'"2026-07-10T14:30"'}</span>
                {"\n}"}
            </pre>
        </div>
    );
}
