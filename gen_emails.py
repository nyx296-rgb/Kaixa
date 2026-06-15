#!/usr/bin/env python3
"""Generate ~100MB of fictitious emails in mbox format for load testing."""

import random
import time
from datetime import datetime, timedelta

DOMAINS = ["example.com", "corp.net", "mail.org", "test.io", "demo.dev", "acme.co", "beta.app"]
TLDS = ["com", "net", "org", "io", "dev", "co", "app", "br", "pt"]
NAMES_MASC = [
    "Joao", "Pedro", "Carlos", "Lucas", "Mateus", "Felipe", "Rafael", "Gabriel",
    "Thiago", "Bruno", "Diego", "Marcos", "Vinicius", "Andre", "Gustavo", "Renato",
    "Ricardo", "Eduardo", "Rodrigo", "Alexandre", "Daniel", "Fabio", "Paulo", "Sergio",
    "Leandro", "Marcio", "Luciano", "Fernando", "Roberto", "Anderson", "Julio", "Alan",
]
NAMES_FEM = [
    "Ana", "Maria", "Carla", "Julia", "Beatriz", "Larissa", "Fernanda", "Patricia",
    "Aline", "Camila", "Bruna", "Vanessa", "Renata", "Amanda", "Jessica", "Debora",
    "Priscila", "Luciana", "Sandra", "Tatiana", "Roberta", "Daniela", "Simone", "Adriana",
    "Mariana", "Leticia", "Isabela", "Vitoria", "Gabriela", "Manuela", "Raquel", "Elisa",
]
SURNAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Lima", "Costa", "Pereira", "Almeida",
    "Nascimento", "Barbosa", "Ribeiro", "Martins", "Carvalho", "Gomes", "Araujo",
    "Melo", "Cavalcanti", "Dias", "Monteiro", "Correia", "Mendes", "Vieira", "Azevedo",
    "Moreira", "Cardoso", "Teixeira", "Castro", "Ferreira", "Rocha", "Campos",
]
CITIES = [
    "Sao Paulo", "Rio de Janeiro", "Belo Horizonte", "Porto Alegre", "Curitiba",
    "Salvador", "Fortaleza", "Recife", "Brasilia", "Manaus", "Campinas", "Niteroi",
    "Santos", "Sao Bernardo do Campo", "Sao Jose dos Campos", "Ribeirao Preto",
    "Uberlandia", "Sao Luis", "Natal", "Maceio", "Teresina", "Joao Pessoa",
]
SUBJECTS_SMALL = [
    "Reuniao amanha as 14h",
    "Favor revisar documento",
    "Aprovacao necessaria",
    "Relatorio mensal",
    "Lembrete: prazo proxima semana",
    "Enc: Orcamento 2026",
    "Atualizacao do projeto",
    "Convite para evento",
    "Almoco de confraternizacao",
    "Aviso importante",
    "Segue anexo",
    "Pauta da reuniao",
    "Indicacao de fornecedor",
    "Solicitacao de ferias",
    "Feedback sobre apresentacao",
    "Novo colaborador",
    "Mudanca de endereco",
    "Treinamento obrigatorio",
    "Pesquisa de clima organizacional",
    "Comunicado da diretoria",
    "Fwd: Oportunidade de parceria",
    "Agradecimento",
    "Parabens pela conquista",
    "Resultados do trimestre",
    "Convocacao para assembleia",
]
SUBJECTS_MEDIUM = [
    "Analise detalhada do projeto X - v3",
    "Proposta comercial completa - anexos",
    "Relatorio de auditoria interna 2026",
    "Documentacao tecnica do sistema",
    "Plano de negocios 2026-2027",
    "Parecer juridico completo",
    "Especificacao funcional v2.1",
    "Relatorio de sustentabilidade",
    "Estudo de viabilidade economica",
    "Manual de integracao API v3",
]

def random_name():
    pool = NAMES_MASC + NAMES_FEM
    return f"{random.choice(pool)} {random.choice(SURNAMES)}"

def random_email():
    name = random.choice(NAMES_MASC + NAMES_FEM).lower()
    surname = random.choice(SURNAMES).lower()
    num = random.randint(1, 999)
    domain = random.choice(DOMAINS)
    return f"{name}.{surname}{num}@{domain}"

def make_date():
    start = datetime(2024, 1, 1)
    end = datetime(2026, 5, 26)
    delta = end - start
    seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=seconds)

def make_header_date(dt):
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{days[dt.weekday()]} {months[dt.month-1]} {dt.day:02d} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} {dt.year}"

def rfc2822_date(dt):
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return f"{days[dt.weekday()]}, {dt.day:02d} {months[dt.month-1]} {dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} -0300"

def make_message_id():
    return f"<{random.getrandbits(64):016x}.{int(time.time())}@mail.{random.choice(DOMAINS)}>"

def small_body():
    paras = random.randint(1, 3)
    lines_per_para = random.randint(2, 6)
    lines = []
    for _ in range(paras):
        words = random.randint(8, 30)
        line = " ".join(random.choice(
            ["segue", "informacao", "conforme", "discutido", "por favor", "verificar",
             "anexo", "documento", "reuniao", "prazo", "aprovacao", "retorno",
             "disponivel", "obrigado", "atencao", "seguir", "abaixo", "segue em anexo",
             "conforme combinado", "desde ja", "aguardo", "qualquer duvida", "estou a disposicao",
             "att", "prezados", "bom dia", "boa tarde", "boa noite", "cordialmente",
             "prazos", "entregaveis", "orcamento", "proposta", "contrato", "fatura"]
        ) for _ in range(words))
        lines.append(line.capitalize() + ".")
        for _ in range(lines_per_para - 1):
            words = random.randint(8, 20)
            line = " ".join(random.choice(
                ["o", "a", "os", "as", "de", "do", "da", "em", "para", "com", "por",
                 "este", "esta", "esse", "essa", "nosso", "nossa", "seu", "sua",
                 "conforme", "segundo", "mediante", "durante", "sobre", "apos",
                 "tambem", "ainda", "porem", "portanto", "assim", "entao",
                 "protocolo", "registro", "sistema", "processo", "analise",
                 "documentacao", "relatorio", "procedimento", "solicitacao"]
            ) for _ in range(words))
            lines.append(line.capitalize() + ".")
    return "\n".join(lines)

def medium_body():
    paras = random.randint(4, 10)
    lines = []
    for _ in range(paras):
        lines_per_para = random.randint(3, 8)
        for _ in range(lines_per_para):
            words = random.randint(10, 40)
            line = " ".join(random.choice(
                ["conforme", "analisado", "verificado", "documentado", "aprovado",
                 "registrado", "processado", "validado", "consolidado", "reportado",
                 "monitorado", "avaliado", "inspecionado", "certificado", "homologado",
                 "contrato", "clausula", "paragrafo", "inciso", "alinea",
                 "item", "subitem", "anexo", "apendice", "referencia",
                 "normativa", "regulamento", "portaria", "resolucao", "instrucao",
                 "tecnico", "operacional", "administrativo", "financeiro", "juridico",
                 "orçamento", "cronograma", "entregavel", "milestone", "sprint",
                 "stakeholder", "deliverable", "workflow", "pipeline", "dashboard"]
            ) for _ in range(words))
            lines.append(line.capitalize() + ",")
        lines.append("")
    return "\n".join(lines)

def large_body():
    """Generate a large plain text body to simulate large email (no real attachment)."""
    lines = []
    for _ in range(random.randint(200, 2000)):
        words = random.randint(10, 30)
        line = " ".join(random.choice(
            ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing",
             "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore",
             "et", "dolore", "magna", "aliqua", "ut", "enim", "ad", "minim", "veniam",
             "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip"]
        ) for _ in range(words))
        lines.append(line.capitalize() + ".")
    return "\n".join(lines)

def make_email(category="small"):
    sender = random_email()
    recipient = random_email()
    dt = make_date()
    msgid = make_message_id()

    if category == "small":
        subject = random.choice(SUBJECTS_SMALL)
        body = small_body()
        content_type = "text/plain; charset=UTF-8"
    elif category == "medium":
        subject = random.choice(SUBJECTS_MEDIUM)
        body = medium_body()
        content_type = "text/plain; charset=UTF-8"
    else:
        subject = f"Documentos anexos - {random.randint(1000,9999)}"
        body = large_body()
        content_type = "text/plain; charset=UTF-8"

    headers = (
        f"From {sender} {make_header_date(dt)}\n"
        f"From: \"{random_name()}\" <{sender}>\n"
        f"To: \"{random_name()}\" <{recipient}>\n"
        f"Subject: {subject}\n"
        f"Date: {rfc2822_date(dt)}\n"
        f"Message-ID: {msgid}\n"
        f"MIME-Version: 1.0\n"
        f"Content-Type: {content_type}\n"
        f"Content-Transfer-Encoding: 8bit\n"
        f"X-Mailer: LoadTestGen/1.0\n"
        f"X-Priority: {'1' if category == 'large' else random.choice(['3','5'])}\n"
        f"\n"
    )
    return headers + body + "\n"

def main():
    target_bytes = 100 * 1024 * 1024
    output_file = "/home/mv/test_emails.mbox"

    # Distribution realistic: ~70% small, ~25% medium, ~5% large
    # But to hit exactly 100MB efficiently, we'll generate mostly small + medium
    # and sample large ones to fill remaining space.

    written = 0
    count = {"small": 0, "medium": 0, "large": 0}

    with open(output_file, "w", encoding="utf-8") as f:
        # Phase 1: generate small
        while written < target_bytes * 0.60:
            email = make_email("small")
            f.write(email)
            written += len(email.encode("utf-8"))
            count["small"] += 1

        # Phase 2: generate medium
        while written < target_bytes * 0.90:
            email = make_email("medium")
            f.write(email)
            written += len(email.encode("utf-8"))
            count["medium"] += 1

        # Phase 3: fill rest with large emails
        while written < target_bytes:
            email = make_email("large")
            f.write(email)
            written += len(email.encode("utf-8"))
            count["large"] += 1

    actual_mb = written / (1024 * 1024)
    print(f"Arquivo gerado: {output_file}")
    print(f"Tamanho: {actual_mb:.2f} MB")
    print(f"E-mails: {count['small']} pequenos, {count['medium']} medios, {count['large']} grandes (total: {sum(count.values())})")

if __name__ == "__main__":
    main()
