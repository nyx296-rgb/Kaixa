import os
import email
from email.message import EmailMessage
import mailbox
import datetime

# 1. Generate an EML file
eml_msg = EmailMessage()
eml_msg['Subject'] = 'Olá do Kaixa! 🚀'
eml_msg['From'] = 'remetente@exemplo.com'
eml_msg['To'] = 'destinatario@exemplo.com'
eml_msg['Date'] = email.utils.format_datetime(datetime.datetime.now())
eml_msg.set_content('Este é um e-mail de teste em texto puro.\n\nAbraços,\nEquipe Kaixa')
eml_msg.add_alternative('''
<html>
  <body>
    <h1 style="color: #4f46e5;">Kaixa Teste</h1>
    <p>Este é um e-mail de teste com <strong>HTML</strong> e caracteres especiais: áéíóú ç ãõ.</p>
    <br/>
    <p><i>Abraços,<br/>Equipe Kaixa</i></p>
  </body>
</html>
''', subtype='html')

# Add a dummy attachment
eml_msg.add_attachment(b'Conteudo do anexo de texto simples.', maintype='text', subtype='plain', filename='anexo.txt')

with open('test_data/teste_simples.eml', 'wb') as f:
    f.write(eml_msg.as_bytes())


# 2. Generate an MBOX file with multiple emails
mbox_path = 'test_data/caixa_entrada.mbox'
if os.path.exists(mbox_path):
    os.remove(mbox_path)

mbox = mailbox.mbox(mbox_path)

for i in range(1, 6):
    msg = EmailMessage()
    msg['Subject'] = f'Mensagem na MBOX - #{i}'
    msg['From'] = 'newsletter@sistema.com'
    msg['To'] = 'voce@exemplo.com'
    msg['Date'] = email.utils.format_datetime(datetime.datetime.now() - datetime.timedelta(days=i))
    msg.set_content(f'Conteúdo da mensagem {i} gerada dinamicamente.')
    mbox.add(msg)

mbox.flush()
mbox.close()

print("Arquivos de teste criados com sucesso na pasta test_data/")
