"""
Build the Elata knowledge base JSON from the source PDF text pages.

Input:  one folder per document, each containing N.txt files (one per page).
Output: data/kb.json — list of {doc_id, doc_label, page, text}.

This script is committed for reproducibility. The output kb.json is also
committed, so the app runs without re-running this.
"""
import json
import re
import sys
from pathlib import Path

DOC_LABELS = {
    "IFUE300S_E300KS": "User Manual — E300 Clinical Foam Mattress",
    "IFUE400SE400KS": "User Manual — E400 Hybrid Mattress System",
    "IFUE500SE500KS": "User Manual — E500 Hybrid Mattress System",
    "IFUE600SE600KS": "User Manual — E600 Alternating Air System",
    "IFUE700SE700KS": "User Manual — E700 Alternating Air System",
    "E300_Clinical_Foam_Mattress_Brochure": "Brochure — E300 Clinical Foam Mattress",
    "Hybrid_System_Brochure_E400_E500": "Brochure — E400/E500 Hybrid System",
    "Alternating_Air_System_Brochure_E600_E700": "Brochure — E600/E700 Alternating Air System",
    "Home_Care_Mattress_Brochure": "Brochure — Home Care Mattress Range",
    "Pressure_Map_Clinical_Foam_Mattress_E300": "Pressure Map Report — E300 Clinical Foam Mattress",
    "Pressure_Map_Hybrid_Mattress_System": "Pressure Map Report — Hybrid Mattress System",
    "Pressure_Map_Alternating_Air_System": "Pressure Map Report — Alternating Air System",
}


def clean(text: str) -> str:
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main(src_dir: str, out_file: str) -> None:
    src = Path(src_dir)
    out = Path(out_file)
    out.parent.mkdir(parents=True, exist_ok=True)

    chunks = []
    for folder in sorted(src.iterdir()):
        if not folder.is_dir():
            continue
        label = DOC_LABELS.get(folder.name, folder.name)
        txts = sorted(folder.glob("*.txt"), key=lambda p: int(p.stem))
        for txt_file in txts:
            page_no = int(txt_file.stem)
            raw = txt_file.read_text(encoding="utf-8", errors="ignore")
            cleaned = clean(raw)
            if len(cleaned) < 20:
                continue
            chunks.append({
                "doc_id": folder.name,
                "doc_label": label,
                "page": page_no,
                "text": cleaned,
            })

    out.write_text(json.dumps(chunks, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(chunks)} chunks to {out}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "../source_pdfs_extracted"
    out = sys.argv[2] if len(sys.argv) > 2 else "../data/kb.json"
    main(src, out)
