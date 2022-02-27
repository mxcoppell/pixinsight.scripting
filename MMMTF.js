#feature-id    MX Sutra > MMMTFStars

#feature-info  Generates Stars from linear RGB data for tight core and good star profile.<br/>\
               <br/>\
               Copyright &copy; 2022 Team Noctua: Min Xie, Chen Wu, Yizhou Zhang, Benchu Tang

#define ID     "MMMTFStars"

#include <pjsr/NumericControl.jsh>

#define TITLE  "MX's MTF Based Stars"
#define VERSION "2.26.22"

// Shadows clipping point in (normalized) MAD units from the median.
#define DEFAULT_AUTOSTRETCH_SCLIP  -2.80
// Target mean background in the [0,1] range.
#define DEFAULT_AUTOSTRETCH_TBGND   0.25
// Apply the same STF to all nominal channels (true), or treat each channel
// separately (false).
#define DEFAULT_AUTOSTRETCH_CLINK   true

var MMMParams ={
   mtfactive : [1,0,1,0,1,0,1,0,1,0],
   s : [0,0,0,0,0,0,0,0,0,0,0],
   gs : 0,
   targetView: undefined,
   destar : 0
}

function PMView(view, newvname, formula){
     var p = new PixelMath();
      with ( p )
      {
         expression = formula;
         /*
         Console.writeln("--- *** ---");
         */
         expression1 = "";
         expression2 = "";
         expression3 = "";
         useSingleExpression = true;
         use64BitWorkingImage = false;
         rescale = false;
         rescaleLower = 0.0000000000;
         rescaleUpper = 1.0000000000;
         truncate = true;
         truncateLower = 0.0000000000;
         truncateUpper = 1.0000000000;
         createNewImage = true;  // changed true to false
         newImageId = newvname;
         newImageWidth = 0;
         newImageHeight = 0;
         newImageAlpha = false;
         newImageColorSpace = PixelMath.prototype.SameAsTarget;
         newImageSampleFormat = PixelMath.prototype.SameAsTarget;
         showNewImage = true;
      }

      if (! p.executeOn(view) )
      {
         (new MessageBox("PixelMath -  Error", TITLE + " " + VERSION)).execute();
      }
      else
      {
         var w = ImageWindow.activeWindow;
         Console.writeln("New view created. " );
      }
      p = null;

}

function STFAutoStretch( view, v, lvl, shadowsClipping, targetBackground, rgbLinked )
{
   if ( shadowsClipping == undefined )
      shadowsClipping = DEFAULT_AUTOSTRETCH_SCLIP;
   if ( targetBackground == undefined )
      targetBackground = DEFAULT_AUTOSTRETCH_TBGND;
   if ( rgbLinked == undefined )
      rgbLinked = DEFAULT_AUTOSTRETCH_CLINK;

   var stf = new ScreenTransferFunction;

   var n = view.image.isColor ? 3 : 1;

   var median = view.computeOrFetchProperty( "Median" );

   var mad = view.computeOrFetchProperty( "MAD" );
   mad.mul( 1.4826 ); // coherent with a normal distribution

            var c0 = 0, m = 0;
         for ( var c = 0; c < n; ++c )
         {
            if ( 1 + mad.at( c ) != 1 )
               c0 += median.at( c ) + shadowsClipping * mad.at( c );
            m  += median.at( c );
         }
         c0 = Math.range( c0/n, 0.0, 1.0 );
         m = Math.mtf( targetBackground, m/n - c0 );

         stf.STF = [ // c0, c1, m, r0, r1
                     [c0, 1, m*lvl, 0, 1],
                     [c0, 1, m*lvl, 0, 1],
                     [c0, 1, m*lvl, 0, 1],
                     [0, 1, 0.5, 0, 1] ];

         Console.show();
         Console.writeln("Midtone: " +m);
   //stf.executeOn( v , true);
   stf = null;

   var P = new HistogramTransformation;
P.H = [ // c0, m, c1, r0, r1
   [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
   [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
   [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
   [c0, m*lvl, 1.00000000, 0.00000000, 1.00000000],
   [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000]
];
   P.executeOn( v, true);
   P = null;

}

function DeStar(view){
   if (MMMParams.destar == 0){
      var P = new StarXTerminator;
      P.stars = true;
      P.linear = false;
   }else if(MMMParams.destar == 1){
      var P = new StarNet;
      P.stride = StarNet.prototype.Stride_128;
      P.mask = true;
   }else{
      var P = new StarNet2;
      P.stride = StarNet2.prototype.itemOne;
      P.mask = true;
   }
   P.executeOn(view);
   P = null;
}

function screenF(str1, str2){
   return "~(~"+str1+"*~"+str2+")";
}

function AddColorSaturation(v,s){
   if (s>0){
      Console.writeln("Add color saturation");
      var P = new ColorSaturation;
      P.HS = [ // x, y
         [0.00000, s],
         [1.00000, s]
      ];
      P.HSt = ColorSaturation.prototype.AkimaSubsplines;
      P.hueShift = 0.000;
      P.executeOn(v, true);
      P = null;
   }
   else
      Console.writeln("No color saturation");
}

function mmmtf(){
   var vnames = [];
   var v = MMMParams.targetView;
   var seq = 0;
   if (v!=null){
      var vact = [];
      for(var i=1; i<=10; i++){
         if (MMMParams.mtfactive[i-1]){
            var lvl = Math.pow(2,i);
            vnames[i] = MMMParams.targetView.id + '_mtf' + lvl;
            PMView(MMMParams.targetView, vnames[i],"$T");
            v = View.viewById(vnames[i]);
            switch(MMMParams.destar){
               case 0:
                  vact.push(vnames[i]+"_stars");break;
               case 1:
               case 2:
                  if (seq==1)
                     vact.push("star_mask");
                  else
                     vact.push("star_mask"+seq);

            }
            seq++;
            Console.writeln("STF/HT...");
            STFAutoStretch(MMMParams.targetView, v, lvl);
            Console.writeln("SXT...");
            DeStar(v);
            AddColorSaturation(v,MMMParams.s[i-1]);
         }
      }
      seq = 0;
      Console.writeln("Blending...");
      while (vact.length >1){
            PMView(v,"blend"+seq,screenF(vact[0],vact[1]));
            vact.shift();
            vact.shift();
            vact.push("blend"+seq);
            seq++;
      }
      if (MMMParams.gs > 0){
         v = View.viewById("blend"+(seq-1));
         AddColorSaturation(v,MMMParams.gs);
      }
   }else
      Console.writeln("View has to be selected");
}

function MMMTFDialog(){
   this.__base__ = Dialog;
   this.__base__();

   this.title = new TextBox(this);
   this.title.readonly = true;
   this.title.text = "MX's Multiple MTF Based Stars";
   this.title.maxHeight = 40;

   this.treebox = new TreeBox(this);
   with (this)
   {
      treebox.multipleSelection = false;
      treebox.nodeExpansion = true;
      treebox.numberOfColumns =  3;
      treebox.rootDecoration  = false;
      treebox.setScaledMinSize( 350, 300 );
      var hdr = 'Level,MTF Scale,Params'.split(',');
      for (var i = 0; i < hdr.length; i++) treebox.setHeaderText(i, hdr[i]);
      treebox.setScaledMinHeight(180);
   }

   for(var i=1;i<=10; i++){
      let node = new TreeBoxNode( this.treebox );
      node.setText(0, i+"");
      if (MMMParams.mtfactive[i-1])
         node.setIcon(0, ":/icons/ok.png");
      else
         node.setIcon(0, ":/icons/delete.png");
      node.setText(1,Math.pow(2,i)+"");
   }

   this.lvlbx = new GroupBox(this);
   this.glbbx = new GroupBox(this);

   this.saturation = new NumericControl(this);
   with (this){
      saturation.setRange(0,1);
      saturation.real = true;
      saturation.minWidth = 250;
      saturation.setPrecision(2);
      saturation.label.text = "Saturation:"
      saturation.enabled = false;
      saturation.onValueUpdated = function(){
         MMMParams.s[treebox.selectedNodes[0].text(0)-1]=saturation.value;
         treebox.selectedNodes[0].setText(2, saturation.value+"");
      }
      treebox.onNodeClicked = function(){
         var idx = treebox.selectedNodes[0].text(0)-1;
         saturation.enabled = true;
         saturation.setValue(MMMParams.s[idx]);
      }
      treebox.onNodeDoubleClicked = function(){
         var idx = treebox.selectedNodes[0].text(0)-1;
         if (MMMParams.mtfactive[idx]==1){
            treebox.selectedNodes[0].setIcon(0, ":/icons/delete.png");
            MMMParams.mtfactive[idx]=0;
         }
         else{
            treebox.selectedNodes[0].setIcon(0, ":/icons/ok.png");
            MMMParams.mtfactive[idx]=1;
         }
         saturation.enabled = true;
         saturation.setValue(MMMParams.s[idx]);
      }
   }


   this.gsaturation = new NumericControl(this);
   with (this){
      gsaturation.setRange(0,1);
      gsaturation.real = true;
      gsaturation.minWidth = 250;
      gsaturation.setPrecision(2);
      gsaturation.label.text = "Global Saturation:"
      gsaturation.enabled = true;
      gsaturation.onValueUpdated = function(){
         MMMParams.gs = gsaturation.value;
      }
   }

   with (this.lvlbx){
      title = "Level Parameters";
      sizer = new VerticalSizer(this);
      sizer.add(this.saturation);
   }

   this.viewList = new ViewList(this);
   with (this.viewList){
      getMainViews();
      onViewSelected = function(view){
         MMMParams.targetView = view;
      }
   }

   this.fileLbl = new Label(this);
   with (this.fileLbl){
      text = "RGB Master File (Linear):";
   }

   this.rbSXT = new RadioButton( this );
   with (this.rbSXT)
   {
      checked = true;
      text = "StarXTerminator";
      toolTip = "<p>Use StarXTerminator</p>";
      onCheck = function( checked )
      {
         MMMParams.destar = 0;
      }
   }

   this.rbSN = new RadioButton( this );
   with (this.rbSN)
   {
      text = "StarNet";
      toolTip = "<p>Evoke StarNet</p>";
      onCheck = function( checked )
      {
         MMMParams.destar = 1;
      }
   }

   this.rbSN2 = new RadioButton( this );
   with (this.rbSN2)
   {
      text = "StarNet 2";
      toolTip = "<p>Evoke StarNet2</p>";
      onCheck = function( checked )
      {
         MMMParams.destar = 2;
      }
   }

   this.radioButtons = new HorizontalSizer;
   with (this.radioButtons)
   {
      add (this.rbSXT );
      add (this.rbSN );
      add (this.rbSN2 );
   }

   with (this.glbbx){
      title = "Global Parameters";
      sizer = new VerticalSizer(this);
      sizer.add(this.fileLbl);
      sizer.addSpacing(4);
      sizer.add(this.viewList);
      sizer.addSpacing(4);
      sizer.add(this.radioButtons);
      sizer.addSpacing(4);
      sizer.add(this.gsaturation);
   }

   this.okBtn= new PushButton(this);
	with (this.okBtn)
	{
      icon = this.scaledResource(":/icons/ok.png");
		text = "Run";
      onClick = function(){
         mmmtf();
      }
   }

   this.sizer = new VerticalSizer();
   with (this.sizer){
      margin = 10;
      add(this.title);
      add(this.treebox);
      addSpacing(4);
      add(this.lvlbx);
      addSpacing(8);
      add(this.glbbx);
      addSpacing(8);
      add(this.okBtn);
      addSpacing(8);
   }


}

function showDialog(){
   var dialog = new MMMTFDialog();
   return dialog.execute();
}

function main(){
   var retVal = showDialog();
}

MMMTFDialog.prototype = new Dialog;

main();
