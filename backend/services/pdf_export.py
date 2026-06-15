# pdf_export.py
# Email-to-PDF export using Jinja2 templates and WeasyPrint

import os
import io
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# ── Template directory (backend/templates/) ──────────────────────────────
_TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")


def _filesizeformat(value: int) -> str:
    """Formata tamanho de arquivo em formato legível."""
    if value is None:
        return "0 B"
    if value < 1024:
        return f"{value} B"
    elif value < 1024 * 1024:
        return f"{value / 1024:.1f} KB"
    elif value < 1024 * 1024 * 1024:
        return f"{value / (1024 * 1024):.1f} MB"
    else:
        return f"{value / (1024 * 1024 * 1024):.2f} GB"


def _parse_json_list(value) -> list:
    """Converte string JSON para lista, se necessário."""
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            return [value] if value else []
    return []


def _format_date(date_ts: int) -> str:
    """Formata timestamp Unix para data legível."""
    try:
        dt = datetime.fromtimestamp(date_ts, tz=timezone.utc)
        return dt.strftime("%d/%m/%Y %H:%M:%S UTC")
    except Exception:
        return "Data desconhecida"


def _short_date(date_ts: int) -> str:
    """Formata timestamp Unix para data curta (para o índice)."""
    try:
        dt = datetime.fromtimestamp(date_ts, tz=timezone.utc)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return "—"


def _extract_sender_name(sender: str) -> str:
    """Extrai o nome do remetente de um endereço de email."""
    if not sender:
        return "(desconhecido)"
    # "Nome Completo <email@x.com>" → "Nome Completo"
    import re
    match = re.match(r'^"?([^<"]+)"?\s*<', sender)
    if match:
        return match.group(1).strip()
    # email@x.com → email
    return sender.split("@")[0]


def _get_jinja_env() -> Environment:
    """Cria um ambiente Jinja2 apontando para o diretório de templates."""
    env = Environment(loader=FileSystemLoader(_TEMPLATES_DIR))
    env.filters["filesizeformat"] = _filesizeformat
    return env


def _prepare_email_context(email_data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepara o contexto de template para um email."""
    date_ts = email_data.get("date_ts", 0)

    return {
        "subject": email_data.get("subject", "(Sem Assunto)"),
        "sender": email_data.get("sender", ""),
        "recipients": _parse_json_list(email_data.get("recipients", [])),
        "cc": _parse_json_list(email_data.get("cc", [])),
        "bcc": _parse_json_list(email_data.get("bcc", [])),
        "date_formatted": _format_date(date_ts),
        "importance": email_data.get("importance", "normal"),
        "body_html": email_data.get("body_html"),
        "body_text": email_data.get("body_text"),
        "attachments": email_data.get("attachments", []),
        "export_date": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Single email → PDF
# ─────────────────────────────────────────────────────────────────────────────

def render_email_to_pdf(email_data: Dict[str, Any]) -> bytes:
    """
    Renderiza um único email em PDF usando Jinja2 + WeasyPrint.
    email_data deve conter: subject, sender, recipients, cc, bcc,
    date_ts, body_html, body_text, importance, attachments.
    """
    env = _get_jinja_env()
    template = env.get_template("email_template.html")

    context = _prepare_email_context(email_data)
    html_content = template.render(**context)

    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes


# ─────────────────────────────────────────────────────────────────────────────
# Batch (múltiplos emails) → PDF combinado com capa + índice
# ─────────────────────────────────────────────────────────────────────────────

def render_batch_to_pdf(emails: List[Dict[str, Any]], mailbox_name: str = "") -> bytes:
    """
    Renderiza múltiplos emails em um PDF combinado contendo:
      1. Página de capa com estatísticas
      2. Sumário (índice) com link interno para cada email
      3. Cada email em página separada com badge de número

    Cada email começa em uma nova página. O rodapé mostra
    "Página X de Y" automaticamente via CSS @page.
    """
    env = _get_jinja_env()
    cover_template = env.get_template("batch_cover_template.html")
    email_template = env.get_template("email_body_partial.html")

    # ── Calcular estatísticas para a capa ────────────────────────────────
    total_emails = len(emails)

    total_attachments = sum(
        len(e.get("attachments") or []) for e in emails
    )

    senders = set()
    dates_ts = []
    for e in emails:
        sender = e.get("sender", "")
        if sender:
            senders.add(sender)
        ts = e.get("date_ts", 0)
        if ts:
            dates_ts.append(ts)

    total_senders = len(senders)

    date_range_start = ""
    date_range_end = ""
    if dates_ts:
        dates_ts_sorted = sorted(dates_ts)
        date_range_start = _short_date(dates_ts_sorted[0])
        date_range_end = _short_date(dates_ts_sorted[-1])

    # ── Montar itens do índice ───────────────────────────────────────────
    index_items = []
    for i, email_data in enumerate(emails):
        subject = email_data.get("subject", "(Sem Assunto)")
        # Truncar assuntos longos para o índice
        if len(subject) > 70:
            subject = subject[:67] + "…"

        attachments = email_data.get("attachments") or []

        index_items.append({
            "number": i + 1,
            "subject": subject,
            "sender_short": _extract_sender_name(email_data.get("sender", "")),
            "date": _short_date(email_data.get("date_ts", 0)),
            "attachment_count": len(attachments),
        })

    # ── Renderizar capa + índice ─────────────────────────────────────────
    cover_html = cover_template.render(
        mailbox_name=mailbox_name,
        total_emails=total_emails,
        total_attachments=total_attachments,
        total_senders=total_senders,
        date_range_start=date_range_start,
        date_range_end=date_range_end,
        index_items=index_items,
        export_date=datetime.now().strftime("%d/%m/%Y %H:%M"),
    )

    # ── Renderizar cada email ────────────────────────────────────────────
    email_html_parts = []
    for i, email_data in enumerate(emails):
        context = _prepare_email_context(email_data)
        email_rendered = email_template.render(**context)

        # Envolver cada email com separador de página, âncora e badge de nº
        email_wrapped = (
            f'<div class="email-separator" id="email-{i + 1}">'
            f'  <div class="email-number-badge">Email {i + 1} de {total_emails}</div>'
            f'  {email_rendered}'
            f'</div>'
        )
        email_html_parts.append(email_wrapped)

    # ── Combinar tudo em um único HTML ───────────────────────────────────
    # Extrair o <body> da capa (sem fechar </body></html>) para concatenar
    # os emails antes de fechar. O CSS da capa já contém @page com
    # numeração e page-break rules que se aplicam a todo o documento.
    #
    # Estratégia: inserimos os emails renderizados ANTES de </body>
    # da capa, pois o CSS já está lá.
    emails_block = "\n".join(email_html_parts)

    # Inserir os emails antes do fechamento do </body>
    if "</body>" in cover_html:
        combined_html = cover_html.replace("</body>", f"{emails_block}\n</body>")
    else:
        combined_html = cover_html + emails_block

    return HTML(string=combined_html).write_pdf()
