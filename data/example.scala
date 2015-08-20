import org.viz.lightning._
import scala.util.Random

val lgn = Lightning()

val mat = Array.fill(10)(Array.fill(20)(Random.nextDouble()))

lgn.matrix(mat, colormap="Purples")
