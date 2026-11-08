import Phaser from 'phaser';

/**
 * Cena de inicialização: carrega assets e trata falhas de carregamento.
 * Por enquanto não há assets reais — a barra e o tratamento de erro
 * ficam prontos para quando assets forem adicionados.
 */
export class BootScene extends Phaser.Scene {
  private failedKeys: string[] = [];
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('BootScene');
  }

  preload(): void {
    const { width, height } = this.scale;

    const barWidth = 320;
    const barHeight = 16;
    const x = (width - barWidth) / 2;
    const y = height / 2;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 8);

    this.progressBar = this.add.graphics();

    this.statusText = this.add
      .text(width / 2, y + 40, 'Carregando...', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x4caf50, 1);
      this.progressBar.fillRect(x, y, barWidth * value, barHeight);
      this.statusText.setText(`Carregando... ${Math.round(value * 100)}%`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failedKeys.push(file.key);
      console.error('[BootScene] Falha ao carregar asset:', file.key, file.url);
    });

    this.load.on('complete', () => {
      if (this.failedKeys.length > 0) {
        this.showLoadFailure();
      }
    });

    // Mapa e tileset originais da primeira missão.
    this.load.tilemapTiledJSON('mission-01', '/maps/mission-01.tmj');
    this.load.image('mission-tiles', '/tiles/mission-tiles.svg');
  }

  create(): void {
    // Se houve falha durante o preload, showLoadFailure já foi chamado
    // e não devemos avançar.
    if (this.failedKeys.length > 0) {
      return;
    }

    this.scene.start('MissionScene');
  }

  /** Exibe feedback visual de falha e interrompe a transição. */
  private showLoadFailure(): void {
    const { width, height } = this.scale;

    this.progressBar.clear();
    this.progressBar.fillStyle(0xc62828, 1);
    this.progressBar.fillRect(width / 2 - 160, height / 2 - 8, 320, 16);

    const list = this.failedKeys.slice(0, 5).join(', ');
    const extra = this.failedKeys.length > 5 ? ` (+${this.failedKeys.length - 5})` : '';

    this.statusText.setColor('#ff8a80');
    this.statusText.setText(
      [
        'Falha ao carregar assets.',
        `Arquivos: ${list}${extra}`,
        'Verifique o console e recarregue a página.',
      ].join('\n'),
    );

    console.error(
      '[BootScene] Carregamento concluído com erros. Não iniciando MissionScene.',
      this.failedKeys,
    );
  }
}
