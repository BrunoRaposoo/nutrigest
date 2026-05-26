import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface ConsumptionRoomItem {
  room: number;
  items: Array<{ productName: string; quantity: number }>;
}

interface MealRankingItem {
  productName: string;
  productCategory: string;
  totalQuantity: number;
}

interface StockHistoryItem {
  type: string;
  quantity: number;
  runningBalance: number;
  createdAt: Date;
}

@Injectable()
export class PdfService {
  async generateConsumptionByRoomPdf(
    data: ConsumptionRoomItem[],
  ): Promise<Buffer> {
    return this.buildPdf((doc) => {
      this.addHeader(doc, 'Relatório de Consumo por Quarto');
      this.addTable(doc, ['Quarto', 'Produto', 'Quantidade']);

      for (const room of data) {
        for (const item of room.items) {
          doc.text(String(room.room), 40, doc.y, { width: 80 });
          doc.text(item.productName, 130, doc.y - doc.currentLineHeight(), {
            width: 300,
          });
          doc.text(
            String(item.quantity),
            470,
            doc.y - doc.currentLineHeight(),
            {
              width: 80,
              align: 'right',
            },
          );
          doc.moveDown(0.3);
        }
      }

      this.addFooter(doc);
    });
  }

  async generateMealRankingPdf(data: MealRankingItem[]): Promise<Buffer> {
    return this.buildPdf((doc) => {
      this.addHeader(doc, 'Relatório de Ranking de Marmitas');
      this.addTable(doc, ['Produto', 'Categoria', 'Quantidade Total']);

      for (const item of data) {
        doc.text(item.productName, 40, doc.y, { width: 220 });
        doc.text(item.productCategory, 270, doc.y - doc.currentLineHeight(), {
          width: 120,
        });
        doc.text(
          String(item.totalQuantity),
          470,
          doc.y - doc.currentLineHeight(),
          { width: 80, align: 'right' },
        );
        doc.moveDown(0.3);
      }

      this.addFooter(doc);
    });
  }

  async generateStockHistoryPdf(data: StockHistoryItem[]): Promise<Buffer> {
    return this.buildPdf((doc) => {
      this.addHeader(doc, 'Relatório de Histórico de Estoque');
      this.addTable(doc, ['Tipo', 'Quantidade', 'Saldo', 'Data']);

      for (const item of data) {
        doc.text(item.type, 40, doc.y, { width: 120 });
        doc.text(String(item.quantity), 170, doc.y - doc.currentLineHeight(), {
          width: 80,
          align: 'right',
        });
        doc.text(
          String(item.runningBalance),
          270,
          doc.y - doc.currentLineHeight(),
          { width: 80, align: 'right' },
        );
        doc.text(
          item.createdAt.toISOString().slice(0, 10),
          400,
          doc.y - doc.currentLineHeight(),
          { width: 150 },
        );
        doc.moveDown(0.3);
      }

      this.addFooter(doc);
    });
  }

  private buildPdf(
    fillContent: (doc: PDFKit.PDFDocument) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      fillContent(doc);
      doc.end();
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(16).font('Helvetica-Bold').text(title, 40, 40, {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, {
        align: 'center',
      });
    doc
      .fillColor('#000000')
      .moveDown(0.5)
      .moveTo(40, doc.y)
      .lineTo(552, doc.y)
      .strokeColor('#cccccc')
      .stroke()
      .moveDown(0.5);
  }

  private addTable(doc: PDFKit.PDFDocument, headers: string[]): void {
    const cellWidth = (512 - 40) / headers.length;
    doc.fontSize(10).font('Helvetica-Bold');

    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], 40 + i * cellWidth, doc.y, {
        width: cellWidth,
        align: i === headers.length - 1 ? 'right' : 'left',
      });
    }

    doc
      .moveDown(0.2)
      .moveTo(40, doc.y)
      .lineTo(552, doc.y)
      .strokeColor('#000000')
      .stroke()
      .moveDown(0.3);

    doc.fontSize(9).font('Helvetica');
  }

  private addFooter(doc: PDFKit.PDFDocument): void {
    const pageCount = doc.bufferedPageRange()?.count ?? 1;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#999999')
        .text(`Página ${i + 1} de ${pageCount}`, 40, 790, { align: 'center' });
    }
  }
}
