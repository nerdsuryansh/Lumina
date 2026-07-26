import { ChangeEvent, DragEvent, useRef, useState } from "react";
import highPriority from "./high-priority.png";
import tickBox from "./tick-box.png";
import upload from "./upload.png";

type LabResult = {
    name: string;
    value: string;
    range: string;
    status: "Low" | "Normal";
    top: string;
    titleLeft: string;
    detailLeft: string;
    badgeLeft: string;
    icon?: string;
};

const labResults: LabResult[] = [
    {
        name: "Hemoglobin",
        value: "10.2 g/dL",
        range: "Normal Range: 12.0 -15.5 g/dL",
        status: "Low",
        top: "421px",
        titleLeft: "21px",
        detailLeft: "21px",
        badgeLeft: "612px",
        icon: highPriority,
    },
    {
        name: "Glucose",
        value: "95 mg/dL",
        range: "Normal Range: 70 - 99 mg/dL",
        status: "Normal",
        top: "677px",
        titleLeft: "20px",
        detailLeft: "20px",
        badgeLeft: "611px",
        icon: tickBox,
    },
];

export const Desktop = (): JSX.Element => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const selectFile = (file?: File) => {
        if (file) {
            setFileName(file.name);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        selectFile(event.target.files?.[0]);
    };

    const handleDragOver = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setIsDragging(false);
        selectFile(event.dataTransfer.files?.[0]);
    };

    return (
        <main className="bg-[linear-gradient(180deg,rgba(21,35,49,1)_0%,rgba(0,0,0,1)_100%)] w-full min-w-[1440px] min-h-[1024px] relative">
            <section
                className="inline-flex gap-2.5 p-2.5 top-3.5 left-[22px] items-center absolute"
                aria-label="Medical report upload area"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div
                    className={`relative w-[582px] h-[978px] mt-[-1.00px] mb-[-1.00px] ml-[-1.00px] mr-[-1.00px] bg-slate-800 rounded-[45px] border border-dashed ${isDragging ? "border-white" : "border-[#ffffff66]"
                        }`}
                />
            </section>
            <label
                className="absolute top-[475px] left-[173px] w-[297px] h-[73px] flex gap-1 bg-white rounded-[20px] shadow-[0px_0px_31px_#ffffff40] cursor-pointer focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 focus-within:ring-offset-slate-800"
                aria-label="Upload medical report PDF"
            >
                <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                />
                <img
                    className="mt-[25px] w-6 h-[22px] ml-[53px]"
                    alt=""
                    aria-hidden="true"
                    src={upload}
                />
                <span className="mt-[30px] w-[157px] h-3.5 [font-family:'Roboto_Flex-SemiBold',Helvetica] font-semibold text-black text-xs tracking-[0] leading-[normal] whitespace-nowrap">
                    Drag &amp; Drop Medical Report
                </span>
            </label>
            <p className="sr-only" aria-live="polite">
                {fileName ? `${fileName} selected` : ""}
            </p>
            <header className="flex w-[155px] h-[67px] justify-center gap-[8.3px] p-[8.3px] top-[54px] left-[677px] items-center absolute">
                <h1 className="relative w-fit mt-[-2.63px] mb-[-0.97px] ml-[-16.30px] mr-[-16.30px] [text-shadow:0px_0px_20px_#ffffff40] [font-family:'Plus_Jakarta_Sans-Bold',Helvetica] font-bold text-white text-[42.5px] tracking-[0] leading-[normal]">
                    Analysis
                </h1>
            </header>
            <div className="inline-flex justify-center gap-[7.73px] p-[7.73px] top-[113px] left-[662px] items-center absolute">
                <p className="relative w-fit mt-[-0.77px] [font-family:'Plus_Jakarta_Sans-SemiBold',Helvetica] font-semibold text-[#ffffff80] text-[13.5px] tracking-[0] leading-[normal]">
                    Upload a PDF to generate insights
                </p>
            </div>
            <section
                className="absolute top-[174px] left-[663px] w-[733px] h-48"
                aria-labelledby="summary-heading"
            >
                <div className="absolute top-0 left-0 w-[731px] h-48 bg-slate-800 rounded-[25px]" />
                <div className="flex w-[92px] justify-center gap-[4.6px] pl-2.5 pr-[4.6px] py-[4.6px] top-[22px] left-7 shadow-[0px_0px_20px_#ffffff40] items-center absolute">
                    <h2
                        id="summary-heading"
                        className="relative w-[111px] mt-[-0.46px] ml-[-16.80px] mr-[-16.80px] [font-family:'Plus_Jakarta_Sans-SemiBold',Helvetica] font-semibold text-white text-[23.6px] tracking-[0] leading-[normal]"
                    >
                        Summary
                    </h2>
                </div>
                <p className="absolute top-[81px] left-[21px] w-[710px] [font-family:'Plus_Jakarta_Sans-Regular',Helvetica] font-normal text-white text-lg tracking-[0] leading-[normal]">
                    The patient&apos;s lab results indicate mostly normal metabolic
                    functions, though Hemoglobin levels are slightly below the reference
                    range, suggesting mild anemia. Recommend follow-up iron panel.
                </p>
            </section>
            <section aria-label="Lab result details">
                {labResults.map((result) => (
                    <article
                        key={result.name}
                        className="absolute left-[662px] w-[737px] h-[201px]"
                        style={{ top: result.top }}
                        aria-labelledby={`${result.name.toLowerCase()}-heading`}
                    >
                        <div className="absolute top-0 left-0 w-[731px] h-[201px] bg-slate-800 rounded-[28px]" />
                        <h2
                            id={`${result.name.toLowerCase()}-heading`}
                            className="absolute top-7 w-[148px] [text-shadow:0px_0px_20px_#ffffff40] [font-family:'Plus_Jakarta_Sans-SemiBold',Helvetica] font-semibold text-white text-[23.6px] tracking-[0] leading-[normal]"
                            style={{ left: result.titleLeft }}
                        >
                            {result.name}
                        </h2>
                        <div
                            className="absolute top-[85px] [font-family:'Plus_Jakarta_Sans-Bold',Helvetica] font-bold text-white text-[32px] tracking-[0] leading-[normal]"
                            style={{ left: result.detailLeft }}
                        >
                            {result.value}
                        </div>
                        <p
                            className="absolute top-[125px] [font-family:'Plus_Jakarta_Sans-Regular',Helvetica] font-normal text-[#ffffff99] text-base tracking-[0] leading-[normal]"
                            style={{ left: result.detailLeft }}
                        >
                            {result.range}
                        </p>
                        <div
                            className="absolute top-7 w-[92px] h-[35px]"
                            style={{ left: result.badgeLeft }}
                        >
                            <div
                                className={`absolute top-0 left-0 w-[90px] h-[35px] rounded-[17.48px] ${result.status === "Low" ? "bg-[#fd090999]" : "bg-[#16a34aaa]"
                                    }`}
                            />
                            {result.status === "Low" ? (
                                <>
                                    <img
                                        className="absolute top-1.5 left-[15px] w-[19px] h-[22px]"
                                        alt=""
                                        aria-hidden="true"
                                        src={result.icon}
                                    />
                                    <span className="absolute top-2.5 left-[43px] [font-family:'Plus_Jakarta_Sans-SemiBold',Helvetica] font-semibold text-white text-[11.8px] tracking-[0] leading-[normal]">
                                        Low
                                    </span>
                                </>
                            ) : (
                                <>
                                    <img
                                        className="absolute top-2 left-2 w-[25px] h-[19px]"
                                        alt=""
                                        aria-hidden="true"
                                        src={result.icon}
                                    />
                                    <span className="absolute top-[11px] left-[35px] [font-family:'Plus_Jakarta_Sans-SemiBold',Helvetica] font-semibold text-white text-[11px] tracking-[0] leading-[normal]">
                                        Normal
                                    </span>
                                </>
                            )}
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
};
