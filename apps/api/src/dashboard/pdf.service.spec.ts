import { PdfService } from './pdf.service';

describe('PdfService', () => {
  let service: PdfService;

  beforeAll(() => {
    service = new PdfService();
  });

  describe('generateConsumptionByRoomPdf', () => {
    it('should return a Buffer starting with %PDF', async () => {
      const data = [
        {
          room: 101,
          items: [
            { productName: 'Água 500ml', quantity: 10 },
            { productName: 'Coca-Cola', quantity: 5 },
          ],
        },
        {
          room: 102,
          items: [{ productName: 'Sanduíche Natural', quantity: 3 }],
        },
      ];

      const result = await service.generateConsumptionByRoomPdf(data);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(100);
      expect(result.slice(0, 4).toString()).toBe('%PDF');
    });

    it('should handle empty data', async () => {
      const result = await service.generateConsumptionByRoomPdf([]);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generateMealRankingPdf', () => {
    it('should return a Buffer starting with %PDF', async () => {
      const data = [
        {
          productName: 'Frango Grelhado',
          productCategory: 'MEAL',
          totalQuantity: 50,
        },
        {
          productName: 'Água 500ml',
          productCategory: 'BEVERAGE',
          totalQuantity: 30,
        },
      ];

      const result = await service.generateMealRankingPdf(data);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(100);
      expect(result.slice(0, 4).toString()).toBe('%PDF');
    });

    it('should handle empty data', async () => {
      const result = await service.generateMealRankingPdf([]);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('generateStockHistoryPdf', () => {
    it('should return a Buffer starting with %PDF', async () => {
      const data = [
        {
          type: 'IN',
          quantity: 20,
          runningBalance: 20,
          createdAt: new Date('2026-01-01'),
        },
        {
          type: 'CONSUMPTION',
          quantity: 5,
          runningBalance: 15,
          createdAt: new Date('2026-01-02'),
        },
      ];

      const result = await service.generateStockHistoryPdf(data);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(100);
      expect(result.slice(0, 4).toString()).toBe('%PDF');
    });

    it('should handle empty data', async () => {
      const result = await service.generateStockHistoryPdf([]);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.slice(0, 4).toString()).toBe('%PDF');
    });
  });
});
